import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  getReminderSettings,
  markFiredToday,
  shouldFireToday,
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
    const tick = async () => {
      try {
        const settings = getReminderSettings();
        if (!shouldFireToday(settings)) return;
        // Guard against double-fire within this session
        const key = `${settings.time}`;
        if (firedRef.current === key) return;
        firedRef.current = key;
        markFiredToday();

        const result = await fireReminderNotification();
        if (result === 'shown') {
          toast('Time to write in your diary ✍️', { icon: '⏰' });
        } else {
          toast('Daily reminder: write today\u2019s entry ✍️', { icon: '⏰' });
        }
      } catch (_) {}
    };

    tick();
    const id = setInterval(tick, 30 * 1000);
    return () => clearInterval(id);
  }, []);
}
