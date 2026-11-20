// ─── reminder.js ─────────────────────────────────────────────────────────────
// Two layers:
// 1. Server push (primary): device subscribes via PushManager; the backend
//    tick worker (GitHub Actions cron -> /api/push/tick) delivers the daily
//    reminder at the user's local time even when the app is closed.
// 2. Local check (backup): while the app is open, checks every 30s and fires
//    once/day via the service worker.
// Settings persist in localStorage: { enabled, time: "HH:MM", lastFired: "YYYY-MM-DD" }.

const KEY = 'diary_reminder_v1';

export function getReminderSettings() {
  const fallback = { enabled: false, time: '21:00', lastFired: '' };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!/^\d{2}:\d{2}$/.test(parsed.time || '')) parsed.time = fallback.time;
    return { ...fallback, ...parsed };
  } catch (_) {
    return fallback;
  }
}

export function saveReminderSettings(settings) {
  const next = { ...getReminderSettings(), ...settings };
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

/** Milliseconds from now until today's reminder time (<=0 if passed). */
export function msUntilFire(settings, now = new Date()) {
  const [h, m] = (settings.time || '21:00').split(':').map(Number);
  const target = new Date(now);
  target.setHours(h || 0, m || 0, 0, 0);
  return target.getTime() - now.getTime();
}

export function shouldFireToday(settings, now = new Date()) {
  if (!settings.enabled) return false;
  return msUntilFire(settings, now) <= 0 && settings.lastFired !== todayKey(now);
}

export function markFiredToday() {
  return saveReminderSettings({ lastFired: todayKey() });
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
    icon: '/favicon.svg',
    badge: '/favicon.svg',
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
