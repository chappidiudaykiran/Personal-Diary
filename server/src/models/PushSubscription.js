const mongoose = require('mongoose');

// One row per browser/device push subscription.
// time ("HH:MM") + tzOffset are stored so the tick worker can deliver the
// daily reminder at the user's local time even when their app is closed.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    p256dh: {
      type: String,
      required: true,
    },
    auth: {
      type: String,
      required: true,
    },
    // Reminder time in the user's local "HH:MM" (24h)
    time: {
      type: String,
      default: '21:00',
    },
    // new Date().getTimezoneOffset() at subscribe time (minutes, UTC - local)
    tzOffset: {
      type: Number,
      default: 0,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    // Local "YYYY-MM-DD" of the last delivered reminder (prevents duplicates)
    lastFiredDay: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
