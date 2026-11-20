// ─── reminder.js ─────────────────────────────────────────────────────────────
// Two layers:
// 1. Server push (primary): device subscribes via PushManager; the backend
//    tick worker (GitHub Actions cron -> /api/push/tick) delivers each
//    reminder at the user's local time even when the app is closed.
// 2. Local check (backup): while the app is open, checks every 30s and fires
//    due reminders via the service worker.
// Settings persist in localStorage: { enabled, times: ["HH:MM", ...],
// fired: { "<YYYY-MM-DD>T<HH:MM>": true } }. Legacy single-time settings
// ({ time, lastFired }) are migrated automatically.

const KEY = 'diary_reminder_v1';
export const MAX_REMINDERS = 10;

const TIME_RE = /^\d{2}:\d{2}$/;

function cleanTime(t) {
  if (typeof t !== 'string') return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Unique, sorted, capped list of "HH:MM" strings. */
export function normalizeTimes(list) {
  const seen = new Set();
  for (const t of list || []) {
    const c = cleanTime(t);
    if (c) seen.add(c);
  }
  return [...seen].sort().slice(0, MAX_REMINDERS);
}

export function getReminderSettings() {
  // New installs start with reminders ON — the phone still needs one tap
  // on "Allow" (OS rule), asked via an in-app banner.
  const fallback = { enabled: true, times: ['23:00'], fired: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    let fired = parsed.fired && typeof parsed.fired === 'object' ? parsed.fired : {};
    let times;
    if (Array.isArray(parsed.times)) {
      // Explicit list — empty means the user removed every time (keep zero)
      times = normalizeTimes(parsed.times);
    } else if (cleanTime(parsed.time)) {
      // Migrate legacy single-time shape { time, lastFired }
      times = [cleanTime(parsed.time)];
      if (parsed.lastFired) {
        fired = { ...fired, [`${parsed.lastFired}T${times[0]}`]: true };
      }
    } else {
      times = ['23:00'];
    }
    return { enabled: Boolean(parsed.enabled), times, fired };
  } catch (_) {
    return fallback;
  }
}

export function saveReminderSettings(settings) {
  const current = getReminderSettings();
  const next = { ...current, ...settings };
  if (settings.times !== undefined) next.times = normalizeTimes(settings.times);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (_) {}
  return next;
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function firedKey(day, time) {
  return `${day}T${time}`;
}

/** Milliseconds from now until today's occurrence of `time` (<=0 if passed). */
export function msUntilFire(settingsOrTime, now = new Date(), timeArg) {
  let time;
  if (typeof settingsOrTime === 'string') {
    time = settingsOrTime;
  } else {
    time = timeArg || (settingsOrTime && settingsOrTime.times && settingsOrTime.times[0]) || settingsOrTime.time || '23:00';
  }
  const [h, m] = (time || '21:00').split(':').map(Number);
  const target = new Date(now);
  target.setHours(h || 0, m || 0, 0, 0);
  return target.getTime() - now.getTime();
}

/** All reminder times due right now that haven't fired yet today. */
export function dueTimes(settings, now = new Date()) {
  if (!settings || !settings.enabled) return [];
  const day = todayKey(now);
  const fired = settings.fired || {};
  return (settings.times || []).filter((t) => {
    if (!cleanTime(t)) return false;
    if (fired[firedKey(day, t)]) return false;
    return msUntilFire(t, now) <= 0;
  });
}

export function markFiredTimes(times, now = new Date()) {
  const settings = getReminderSettings();
  const day = todayKey(now);
  const fired = { ...(settings.fired || {}) };
  for (const t of times || []) fired[firedKey(day, t)] = true;
  return saveReminderSettings({ fired });
}

/** Single-time compat: is the (first) reminder due today? */
export function shouldFireToday(settings, now = new Date()) {
  return dueTimes(settings, now).length > 0;
}

export function markFiredToday() {
  const settings = getReminderSettings();
  return markFiredTimes(settings.times);
}

/** Milliseconds until the next reminder (today or tomorrow). Null when disabled/empty. */
export function nextDueMs(settings, now = new Date()) {
  if (!settings || !settings.enabled) return null;
  const times = settings.times || [];
  if (times.length === 0) return null;
  let best = null;
  for (const t of times) {
    if (!cleanTime(t)) continue;
    let ms = msUntilFire(t, now);
    if (ms <= 0) ms += 24 * 60 * 60 * 1000; // tomorrow's occurrence
    if (best === null || ms < best) best = ms;
  }
  return best;
}

export function notificationState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch (_) {
    return Notification.permission;
  }
}

function storedUsername() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    const user = JSON.parse(raw);
    return user?.username || '';
  } catch (_) {
    return '';
  }
}

// ─── Server push (works even when the app is closed) ─────────────────────────
// The service worker receives the push and shows the notification
// (see public/sw-notif-click.js "push" listener).

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function readyRegistration(timeoutMs = 8000) {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // If SW already registered (prod build), use it directly — faster than .ready
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
  } catch (_) {}
  try {
    // Dev server has no SW — try to register the prod one if it exists,
    // otherwise fall through (local notifications still work via `new Notification`).
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);
    if (reg) return reg;
  } catch (_) {}
  try {
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return ready;
  } catch (_) {
    return null;
  }
}

export async function getPushSubscription() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const reg = await readyRegistration();
    if (!reg?.pushManager) return null;
    return await reg.pushManager.getSubscription();
  } catch (_) {
    return null;
  }
}

/** Subscribe this device and register its times with the server. */
export async function registerPushTimes(times) {
  const { default: apiClient } = await import('../api/apiClient.js');
  const sub = await subscribeDevicePush();
  const list = normalizeTimes(times);
  await apiClient.post('/push/subscribe', {
    subscription: sub.toJSON(),
    times: list,
    time: list[0] || '23:00',
    tzOffset: new Date().getTimezoneOffset(),
  });
  return list;
}

/** Subscribe this device for server-sent reminders. Returns the subscription or null. */
export async function subscribeDevicePush() {
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
  if (!vapidKey) throw new Error('Reminders are not set up yet. Please try again later.');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Reminders are not supported on this phone or browser');
  }
  const reg = await readyRegistration();
  if (!reg?.pushManager) {
    throw new Error('Reminder worker is still starting. Reload the page and try again.');
  }
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
}

export async function unsubscribeDevicePush() {
  try {
    const sub = await getPushSubscription();
    if (sub) await sub.unsubscribe();
  } catch (_) {}
}

export async function fireReminderNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return 'denied';
  }
  const name = storedUsername();
  const title = name ? `Hey ${name}, time to write ✍️` : 'My Diary ✍️';
  const options = {
    body: name
      ? `${name}, take a minute to write today\u2019s entry.`
      : 'Take a minute to write today\u2019s entry.',
    tag: 'diary-daily-reminder',
    renotify: true,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // Read by sw-notif-click.js — tapping opens here
    data: { url: '/dashboard' },
    actions: [{ action: 'write', title: 'Write now' }],
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await readyRegistration(4000);
      // showNotification works for installed PWAs / controlled pages
      if (reg?.showNotification) {
        await reg.showNotification(title, options);
        return 'shown';
      }
    }
    new Notification(title, options).onclick = () => {
      try {
        window.focus();
        if (window.location.pathname !== '/dashboard') window.location.assign('/dashboard');
      } catch (_) {}
    };
    return 'shown';
  } catch (_) {
    try {
      new Notification(title, options).onclick = () => {
        try {
          window.focus();
          if (window.location.pathname !== '/dashboard') window.location.assign('/dashboard');
        } catch (_) {}
      };
      return 'shown';
    } catch {
      return 'error';
    }
  }
}
