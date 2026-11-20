// ─── reminder.js ─────────────────────────────────────────────────────────────
// Daily diary reminder using the Web Notification API (no push server needed).
// Settings persist in localStorage: { enabled, time: "HH:MM", lastFired: "YYYY-MM-DD" }.
// The app checks every 30s while open; when the time passes it fires once/day.
// Note: true background delivery while the app is fully closed needs a push
// server — this covers the realistic case (PWA installed / tab open).

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

export async function fireReminderNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return 'denied';
  }
  const title = 'My Diary ✍️';
  const options = {
    body: 'Take a minute to write today\u2019s entry.',
    tag: 'diary-daily-reminder',
    renotify: true,
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      // showNotification works for installed PWAs / controlled pages
      if (reg?.showNotification) {
        await reg.showNotification(title, options);
        return 'shown';
      }
    }
    new Notification(title, options);
    return 'shown';
  } catch (_) {
    try {
      new Notification(title, options);
      return 'shown';
    } catch {
      return 'error';
    }
  }
}
