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

function username() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    return JSON.parse(raw)?.username || '';
  } catch (_) {
    return '';
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), ms)),
  ]);
}

/** Returns true only if OS notifications are actually allowed. */
export async function ensureNativePermission() {
  const api = await ln();
  if (!api) return false;
  try {
    const cur = await withTimeout(
      api.checkPermissions().catch(() => null),
      8000
    );
    if (cur?.display === 'granted') return true;
    // System dialog — no timeout, the user may take time to answer
    const req = await api.requestPermissions().catch(() => null);
    return req?.display === 'granted';
  } catch (_) {
    return false;
  }
}

/** Current OS permission without prompting: 'granted' | 'denied' | 'unknown'. */
export async function getNativePermission() {
  const api = await ln();
  if (!api) return 'unknown';
  try {
    const cur = await api.checkPermissions().catch(() => null);
    return cur?.display === 'granted' ? 'granted' : cur?.display === 'denied' ? 'denied' : 'unknown';
  } catch (_) {
    return 'unknown';
  }
}

/** Schedule (or reschedule) the daily native notification. */
export async function scheduleNativeDaily(time) {
  const api = await ln();
  if (!api) return false;
  const allowed = await ensureNativePermission();
  if (!allowed) return false;
  const name = username();
  try {
    await withTimeout(
      api.cancel({ notifications: [{ id: 9001 }, { id: 9002 }] }).catch(() => {}),
      8000
    );
    const [hh, mm] = (time || '21:00').split(':').map(Number);
    await withTimeout(
      api.schedule({
        notifications: [
          {
            id: 9001,
            title: name ? `Hey ${name}, time to write` : 'My Diary',
            body: name
              ? `${name}, take a minute to write today's entry.`
              : "Take a minute to write today's entry.",
            schedule: {
              // Repeat every day at the chosen time, even if the app is closed
              on: { hour: Number(hh) || 0, minute: Number(mm) || 0 },
              allowWhileIdle: true,
            },
            smallIcon: 'ic_launcher',
            actionTypeId: 'OPEN_DIARY',
          },
        ],
      }),
      15000
    );
    return true;
  } catch (e) {
    console.error('Native schedule failed:', e);
    // Surface the real reason so a stuck toggle can be diagnosed
    throw new Error(e?.message || 'schedule failed');
  }
}

export async function cancelNativeDaily() {
  const api = await ln();
  if (!api) return;
  try {
    await api.cancel({ notifications: [{ id: 9001 }, { id: 9002 }, { id: 9999 }] });
  } catch (_) {}
}

/** Immediate preview notification on native. */
export async function previewNative() {
  const api = await ln();
  if (!api) return false;
  const allowed = await ensureNativePermission();
  if (!allowed) return false;
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
