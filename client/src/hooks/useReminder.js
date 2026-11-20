import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  getReminderSettings,
  markFiredTimes,
  dueTimes,
  nextDueMs,
  todayKey,
  fireReminderNotification,
} from '../utils/reminder.js';

/**
 * Fires the daily diary reminders while the app is open.
 * Supports any number of reminder times: checks every 30s, wakes up exactly
 * at each set time, and shows a system notification (if permitted) plus an
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
        const ms = nextDueMs(settings);
        if (ms === null) return;
        // Wake up right at the next set time (+1s), even if the 30s interval drifts
        timer = setTimeout(() => tick(), Math.min(ms + 1000, 24 * 60 * 60 * 1000));
      } catch (_) {}
    };

    const tick = async () => {
      try {
        const settings = getReminderSettings();
        scheduleNext();
        const due = dueTimes(settings);
        if (due.length === 0) return;
        // Guard against double-fire within this session (per day+times)
        const key = `${todayKey()}-${[...due].sort().join(',')}`;
        if (firedRef.current === key) return;

        let shown = 0;
        for (const t of due) {
          const result = await fireReminderNotification();
          if (result === 'shown') shown += 1;
          else break;
        }
        // Mark fired only if we actually showed something — otherwise retry
        // on the next 30s check instead of skipping the slot.
        if (shown === due.length) {
          firedRef.current = key;
          markFiredTimes(due);
          toast(
            due.length === 1 ? 'Time to write in your diary ✍️' : `${due.length} reminders — time to write ✍️`,
            { icon: '⏰' }
          );
        } else if (shown === 0) {
          firedRef.current = key;
          toast('Time for today\u2019s entry ✍️', { icon: '⏰' });
        } else {
          markFiredTimes(due.slice(0, shown));
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
