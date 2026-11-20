import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  getReminderSettings,
  markFiredToday,
  msUntilFire,
  shouldFireToday,
  todayKey,
  fireReminderNotification,
} from '../utils/reminder.js';

/**
 * Fires the daily diary reminder while the app is open.
 * Checks every 30s; shows a system notification (if permitted) plus an
 * in-app toast so it works even when notifications are blocked.
 */
export function useReminder() {
  const firedRef = useRef('');

  useEffect(() => {
    let timer = null;
    const scheduleNext = () => {
      if (timer) clearTimeout(timer);
      try {
        const settings = getReminderSettings();
        if (!settings.enabled) return;
        const ms = msUntilFire(settings);
        if (ms <= 0) {
          // Already past time today — let the interval tick fire it immediately
          return;
        }
        // Wake up right at the set time (+1s), even if the 30s interval drifts
        timer = setTimeout(() => tick(), Math.min(ms + 1000, 24 * 60 * 60 * 1000));
      } catch (_) {}
    };

    const tick = async () => {
      try {
        const settings = getReminderSettings();
        scheduleNext();
        if (!shouldFireToday(settings)) return;
        // Guard against double-fire within this session (per day+time)
        const key = `${todayKey()}-${settings.time}`;
        if (firedRef.current === key) return;

        const result = await fireReminderNotification();
        // Mark fired only if we actually showed something — otherwise retry
        // on the next 30s check instead of skipping the whole day.
        if (result === 'shown') {
          firedRef.current = key;
          markFiredToday();
          toast('Time to write in your diary ✍️', { icon: '⏰' });
        } else if (result === 'denied') {
          // Permission blocked — don't spam, don't mark fired (user may unblock)
          toast('Time for today\u2019s entry ✍️', { icon: '⏰' });
        }
      } catch (_) {}
    };

    tick();
    scheduleNext();
    const id = setInterval(tick, 30 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    const onStorage = (e) => { if (!e.key || e.key === 'diary_reminder_v1') { tick(); scheduleNext(); } };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(id);
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
}
