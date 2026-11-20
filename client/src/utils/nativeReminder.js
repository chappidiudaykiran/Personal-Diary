// ─── nativeReminder.js ─────────────────────────────────────────────────────
// Capacitor native daily reminder for the Android APK.
// Web push (PushManager + service worker) does not exist in a native WebView,
// and JS timers die when the app is closed — so on native we schedule a
// real OS-level daily notification instead.

import { Capacitor } from '@capacitor/core';

let LN = null;
async function ln() {
  if (LN) return LN;
  if (!isNative()) return null;
  try {
    const mod = await import('@capacitor/local-notifications');
    LN = mod.LocalNotifications;
    return LN;
  } catch (_) {
    return null;
  }
}

export function isNative() {
  try {
    return Capacitor.isNativePlatform();
  } catch (_) {
    return false;
  }
}

function nextDailyDate(hhmm) {
  const [h, m] = (hhmm || '21:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

function username() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    return JSON.parse(raw)?.username || '';
  } catch (_) {
    return '';
  }
}

/** Schedule (or reschedule) the daily native notification. */
export async function scheduleNativeDaily(time) {
  const api = await ln();
  if (!api) return false;
  try {
    await api.requestPermissions();
  } catch (_) {}
  const name = username();
  try {
    await api.cancel({ notifications: [{ id: 9001 }] }).catch(() => {});
    await api.schedule({
      notifications: [
        {
          id: 9001,
          title: name ? `Hey ${name}, time to write` : 'My Diary',
          body: name
            ? `${name}, take a minute to write today's entry.`
            : "Take a minute to write today's entry.",
          schedule: {
            // Repeat every day at the chosen time, even if the app is closed
            on: { hour: Number((time || '21:00').split(':')[0]), minute: Number((time || '21:00').split(':')[1]) },
            allowWhileIdle: true,
          },
          smallIcon: 'ic_launcher',
          actionTypeId: 'OPEN_DIARY',
        },
      ],
    });
    // Fallback for devices that ignore `on:` repeats: also set one exact shot
    try {
      await api.schedule({
        notifications: [
          {
            id: 9002,
            title: name ? `Hey ${name}, time to write` : 'My Diary',
            body: "Take a minute to write today's entry.",
            schedule: { at: nextDailyDate(time), allowWhileIdle: true },
            smallIcon: 'ic_launcher',
          },
        ],
      });
    } catch (_) {}
    return true;
  } catch (e) {
    console.error('Native schedule failed:', e);
    return false;
  }
}

export async function cancelNativeDaily() {
  const api = await ln();
  if (!api) return;
  try {
    await api.cancel({ notifications: [{ id: 9001 }, { id: 9002 }] });
  } catch (_) {}
}

/** Immediate preview notification on native. */
export async function previewNative() {
  const api = await ln();
  if (!api) return false;
  try {
    await api.requestPermissions();
  } catch (_) {}
  const name = username();
  try {
    await api.schedule({
      notifications: [
        {
          id: 9999,
          title: name ? `Hey ${name}, time to write` : 'My Diary',
          body: 'Here is what your reminder will look like.',
          schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
          smallIcon: 'ic_launcher',
        },
      ],
    });
    return true;
  } catch (_) {
    return false;
  }
}
