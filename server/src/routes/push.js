const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const PushSubscription = require('../models/PushSubscription');

// ─── VAPID setup (set these on Render — see README notes) ─────────────────────
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:diary@example.com',
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );
}

const isValidTime = (t) => /^\d{2}:\d{2}$/.test(t || '');

// ─── POST /api/push/subscribe ─────────────────────────────────────────────────
// Body: { subscription: { endpoint, keys: { p256dh, auth } }, time, tzOffset }
// Upserts the device subscription and (re)enables the daily reminder.
router.post(
  '/subscribe',
  protect,
  [
    body('subscription.endpoint').notEmpty().withMessage('endpoint is required'),
    body('subscription.keys.p256dh').notEmpty().withMessage('p256dh is required'),
    body('subscription.keys.auth').notEmpty().withMessage('auth is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { subscription, time, tzOffset } = req.body;
    try {
      const doc = await PushSubscription.findOneAndUpdate(
        { endpoint: subscription.endpoint },
        {
          userId: req.user._id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          time: isValidTime(time) ? time : '21:00',
          tzOffset: Number.isFinite(Number(tzOffset)) ? Number(tzOffset) : 0,
          enabled: true,
        },
        { new: true, upsert: true, runValidators: true }
      );
      res.status(201).json({ message: 'Push subscribed', id: doc._id });
    } catch (error) {
      console.error('Push subscribe error:', error);
      res.status(500).json({ message: 'Failed to save push subscription' });
    }
  }
);

// ─── PUT /api/push/state ──────────────────────────────────────────────────────
// Body: { enabled, time?, tzOffset? } — applies to all of the user's devices.
router.put('/state', protect, async (req, res) => {
  const { enabled, time, tzOffset } = req.body || {};
  try {
    const update = {};
    if (typeof enabled === 'boolean') update.enabled = enabled;
    if (time !== undefined) {
      if (!isValidTime(time)) return res.status(400).json({ message: 'Invalid time (HH:MM)' });
      update.time = time;
    }
    if (tzOffset !== undefined && Number.isFinite(Number(tzOffset))) {
      update.tzOffset = Number(tzOffset);
    }
    await PushSubscription.updateMany({ userId: req.user._id }, update);
    res.json({ message: 'Reminder state updated' });
  } catch (error) {
    console.error('Push state error:', error);
    res.status(500).json({ message: 'Failed to update reminder state' });
  }
});

// ─── DELETE /api/push/unsubscribe ─────────────────────────────────────────────
router.delete('/unsubscribe', protect, async (req, res) => {
  const { endpoint } = req.body || {};
  try {
    if (endpoint) {
      await PushSubscription.findOneAndDelete({ endpoint, userId: req.user._id });
    } else {
      await PushSubscription.deleteMany({ userId: req.user._id });
    }
    res.json({ message: 'Push unsubscribed' });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ message: 'Failed to remove push subscription' });
  }
});

function localDayAndMinutes(dateUtc, tzOffset) {
  // getTimezoneOffset() = UTC - local, so local = UTC - offset
  const local = new Date(dateUtc.getTime() - tzOffset * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return { day: `${y}-${m}-${d}`, minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

function toMinutes(hhmm) {
  const [h, m] = (hhmm || '21:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// ─── GET /api/push/tick?secret=… ──────────────────────────────────────────────
// Called by the GitHub Actions cron every 5 minutes. Sends due reminders.
// Not a user route — guarded by a shared secret, not the login token.
router.get('/tick', async (req, res) => {
  const secret = process.env.PUSH_TICK_SECRET || '';
  if (!secret || req.query.secret !== secret) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({ message: 'Push not configured (VAPID keys missing)' });
  }

  const now = new Date();
  let checked = 0;
  let sent = 0;
  const errors = [];

  try {
    const subs = await PushSubscription.find({ enabled: true }).populate('userId', 'username');
    for (const sub of subs) {
      checked += 1;
      try {
        const { day, minutes } = localDayAndMinutes(now, sub.tzOffset || 0);
        if (sub.lastFiredDay === day) continue; // already reminded today
        if (minutes < toMinutes(sub.time)) continue; // not yet time

        const name = sub.userId?.username || 'friend';
        const payload = JSON.stringify({
          title: `Hey ${name}, time to write ✍️`,
          body: `${name}, take a minute to write today\u2019s entry.`,
          url: '/dashboard',
        });

        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sub.lastFiredDay = day;
        await sub.save();
        sent += 1;
      } catch (err) {
        // 404/410 = subscription gone (uninstalled) — clean it up
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id });
        } else {
          errors.push(String(err?.message || err).slice(0, 120));
        }
      }
    }
    res.json({ checked, sent, errors: errors.slice(0, 5), at: now.toISOString() });
  } catch (error) {
    console.error('Push tick error:', error);
    res.status(500).json({ message: 'Push tick failed' });
  }
});

module.exports = router;
