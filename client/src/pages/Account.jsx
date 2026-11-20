import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Bell, BellOff, Palette, ShieldCheck, KeyRound,
  Lock, LogOut, Save, Loader2, Image as ImageIcon, Sun, Moon, Trash2,
  Plus, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar.jsx';
import SetPinModal from '../components/SetPinModal.jsx';
import WallpaperPicker from '../components/WallpaperPicker.jsx';
import apiClient from '../api/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useWallpaper } from '../context/WallpaperContext.jsx';
import { useWallpaper as useWallpaperColors } from '../context/WallpaperContext.jsx';
import {
  getReminderSettings,
  saveReminderSettings,
  normalizeTimes,
  MAX_REMINDERS,
  notificationState,
  requestNotificationPermission,
  fireReminderNotification,
  subscribeDevicePush,
  unsubscribeDevicePush,
  getPushSubscription,
} from '../utils/reminder.js';
import {
  isNative,
  scheduleNativeDaily,
  cancelNativeDaily,
  previewNative,
  getNativePermission,
} from '../utils/nativeReminder.js';
import { friendlyServerError } from '../utils/friendlyError.js';

function formatTime12(hhmm) {
  const [h, m] = (hhmm || '21:00').split(':').map(Number);
  const period = (h || 0) >= 12 ? 'PM' : 'AM';
  const hour12 = (h || 0) % 12 === 0 ? 12 : ((h || 0) % 12);
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${period}`;
}

function Card({ icon: Icon, title, subtitle, children }) {
  return (
    <section
      className="rounded-2xl p-4 sm:p-5 shadow-sm"
      style={{ background: 'var(--card-gradient)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--gold-glow)', border: '1px solid var(--border-color)' }}
        >
          <Icon className="w-4 h-4" style={{ color: 'var(--gold)' }} />
        </span>
        <div>
          <h2 className="font-display text-base" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          {subtitle && <p className="text-[11px]" style={{ color: 'var(--text-ghost)' }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Row({ label, hint, right }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {hint && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-ghost)' }}>{hint}</p>}
      </div>
      <div className="flex-shrink-0">{right}</div>
    </div>
  );
}

export default function Account() {
  const navigate = useNavigate();
  const { user, updateProfile, logout, lockApp, hasPin, removePin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { wallpaper, presets, topMuted } = useWallpaper();
  const { topInk } = useWallpaperColors();

  const [username, setUsername] = useState(user?.username || '');
  const [savingName, setSavingName] = useState(false);
  const [createdAt, setCreatedAt] = useState(user?.createdAt || null);
  const [entryCount, setEntryCount] = useState(null);
  const [pinSet, setPinSet] = useState(hasPin);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(false);

  const [reminder, setReminder] = useState(getReminderSettings);
  const [newTime, setNewTime] = useState('21:00');
  const [perm, setPerm] = useState('default');
  const [testing, setTesting] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [phonePush, setPhonePush] = useState('unknown'); // on | off | unsupported | unknown
  const [nativePerm, setNativePerm] = useState('unknown'); // native OS permission
  const nativeApp = isNative();

  useEffect(() => {
    setPerm(notificationState());
    // Native APK: re-apply the OS schedule on every launch (survives reboot/update)
    if (isNative()) {
      getNativePermission().then(setNativePerm).catch(() => {});
      const settings = getReminderSettings();
      if (settings.enabled) {
        scheduleNativeDaily(settings.times).then((ok) => {
          setPhonePush(ok ? 'on' : 'off');
          getNativePermission().then(setNativePerm).catch(() => {});
        }).catch(() => setPhonePush('off'));
      } else {
        setPhonePush('off');
      }
    } else {
    // Auto-connect by default: if the reminder is ON but this phone was never
    // registered (stale ON state), register it silently — no extra button.
    getPushSubscription().then(async (sub) => {
      if (sub) {
        setPhonePush('on');
        // Local sub exists but server may have lost it (DB reset) — re-sync.
        try {
          const { data } = await apiClient.get('/push/status');
          if (data && data.count === 0) {
            const settings = getReminderSettings();
            if (settings.enabled && notificationState() === 'granted') {
              await connectPhonePush(settings.times);
            } else {
              setPhonePush('off');
            }
          }
        } catch (_) {}
        return;
      }
      setPhonePush('off');
      const settings = getReminderSettings();
      if (settings.enabled && notificationState() === 'granted') {
        try {
          await connectPhonePush(settings.times);
          toast.success('This phone will get reminders ✅');
        } catch (_) {
          // Stays off — toggling the switch off/on retries (user gesture)
        }
      }
    }).catch(() => setPhonePush('unknown'));
    }
    // Refresh profile (createdAt) + entry count + server-registered phones
    (async () => {
      try {
        const { data } = await apiClient.get('/auth/me');
        if (data?.user?.createdAt) setCreatedAt(data.user.createdAt);
      } catch (_) {}
      try {
        const { data } = await apiClient.get('/entries');
        setEntryCount((data.entries || []).length);
      } catch (_) {}
    })();
  }, []);

  /** Register this phone with the server for push reminders. */
  const connectPhonePush = async (times) => {
    const sub = await subscribeDevicePush();
    const list = normalizeTimes(times);
    await apiClient.post('/push/subscribe', {
      subscription: sub.toJSON(),
      times: list,
      time: list[0] || '21:00', // fallback for older servers
      tzOffset: new Date().getTimezoneOffset(),
    });
    setPhonePush('on');
  };

  /** Push the current local times list to native scheduler / server. */
  const syncTimes = async (list) => {
    if (isNative()) {
      if (reminder.enabled) {
        try {
          await scheduleNativeDaily(list);
        } catch (_) {
          toast.error("Couldn't update reminder times. Try again.");
        }
      }
      return;
    }
    if (reminder.enabled) {
      try {
        const existing = await getPushSubscription();
        if (!existing) {
          await connectPhonePush(list);
        } else {
          await apiClient.put('/push/state', {
            times: list,
            time: list[0] || '21:00',
            tzOffset: new Date().getTimezoneOffset(),
          });
        }
      } catch (_) {
        toast.error("Times saved on this phone, but not on your other devices. Check your internet and try again.");
      }
    }
  };

  const persistReminder = (next) => {
    setReminder(saveReminderSettings(next));
  };

  const handleToggleReminder = async () => {
    if (pushBusy) return;
    // ── Native APK path: OS-level notifications (no web push in WebView)
    if (isNative()) {
      if (!reminder.enabled) {
        // Seed a default time if the list was emptied before
        const times = (reminder.times || []).length > 0 ? reminder.times : ['21:00'];
        if (times !== reminder.times) persistReminder({ times });
        setPushBusy(true);
        try {
          const ok = await scheduleNativeDaily(times);
          if (!ok) {
            toast.error('Notifications are blocked. Allow them in phone Settings > Apps > Diary, then try again.');
            setPhonePush('off');
            setNativePerm('denied');
            return;
          }
          setPhonePush('on');
          setNativePerm('granted');
          persistReminder({ enabled: true });
          toast.success(`Reminders set (${times.length}) ✅`);
        } catch (err) {
          console.error('Native reminder failed:', err);
          const reason = String(err?.message || '').slice(0, 90);
          toast.error(
            reason
              ? `Couldn't turn on reminders (${reason}). Try again.`
              : "Couldn't turn on reminders on this phone. Please try again."
          );
        } finally {
          setPushBusy(false);
        }
      } else {
        setPushBusy(true);
        try {
          await cancelNativeDaily();
        } catch (_) {} finally {
          setPushBusy(false);
        }
        setPhonePush('off');
        persistReminder({ enabled: false });
        toast.success('Daily reminder turned off');
      }
      return;
    }
    if (!reminder.enabled) {
      // Enabling — need permission first, then register this phone with the server
      let p = notificationState();
      if (p === 'unsupported') {
        toast.error("Your browser can't show reminders");
        return;
      }
      if (p !== 'granted') {
        p = await requestNotificationPermission();
        setPerm(p);
        if (p !== 'granted') {
          toast.error('Please turn on reminders to continue');
          return;
        }
      }
      setPushBusy(true);
      try {
        // Seed a default time if the list was emptied before
        const times = (reminder.times || []).length > 0 ? reminder.times : ['21:00'];
        await connectPhonePush(times);
        persistReminder({ times, enabled: true });
        toast.success(`Reminders set (${times.length}) ✅`);
      } catch (err) {
        console.error('Enable reminder failed:', err);
        setPhonePush('unsupported');
        toast.error(
          friendlyServerError(
            err?.response?.data?.message || err?.message,
            "Couldn't turn on reminders on this phone. Please try again."
          )
        );
      } finally {
        setPushBusy(false);
      }
    } else {
      setPushBusy(true);
      try {
        await apiClient.put('/push/state', { enabled: false });
        setPhonePush('off');
      } catch (_) {
        // Local off still applies even if the server call fails
      } finally {
        setPushBusy(false);
      }
      persistReminder({ enabled: false });
      toast.success('Daily reminder turned off');
    }
  };

  const handleAddTime = async () => {
    const list = normalizeTimes([...(reminder.times || []), newTime]);
    if (list.length === (reminder.times || []).length) {
      toast.error('That time is already in your list');
      return;
    }
    if (list.length > MAX_REMINDERS) {
      toast.error(`You can set up to ${MAX_REMINDERS} reminders`);
      return;
    }
    persistReminder({ times: list });
    toast.success(`Reminder added for ${formatTime12(list[list.indexOf(newTime)] || newTime)} ✅`);
    // Move the picker forward so the just-added time isn't shown by default
    const [hh, mm] = (newTime || '21:00').split(':').map(Number);
    const nextH = ((Number(hh) || 0) + 1) % 24;
    setNewTime(`${String(nextH).padStart(2, '0')}:${String(Number(mm) || 0).padStart(2, '0')}`);
    await syncTimes(list);
  };

  const handleRemoveTime = async (time) => {
    const list = (reminder.times || []).filter((t) => t !== time);
    if (list.length === 0) {
      // No times left = reminders off
      persistReminder({ times: [], enabled: false });
      setPhonePush('off');
      try {
        if (isNative()) {
          await cancelNativeDaily();
        } else {
          await apiClient.put('/push/state', { enabled: false });
          await unsubscribeDevicePush().catch(() => {});
        }
      } catch (_) {}
      toast.success('Reminders turned off');
      return;
    }
    persistReminder({ times: list });
    await syncTimes(list);
  };

  const handleRemoveDevice = async () => {
    if (isNative()) {
      try {
        await cancelNativeDaily();
      } catch (_) {}
      setPhonePush('off');
      persistReminder({ enabled: false });
      toast.success('Reminders turned off for this phone');
      return;
    }
    try {
      const sub = await getPushSubscription();
      await apiClient.delete('/push/unsubscribe', { data: { endpoint: sub?.endpoint } });
      await unsubscribeDevicePush();
      setPhonePush('off');
      toast.success('Reminders turned off for this phone');
    } catch (_) {
      toast.error("Couldn't remove reminders from this phone");
    }
  };

  const handleTestReminder = async () => {
    setTesting(true);
    try {
      if (isNative()) {
        const ok = await previewNative();
        if (ok) {
          toast.success("Here is what your reminder will look like 🔔");
        } else {
          toast.error('Notifications are blocked. Allow them in phone Settings > Apps > Diary.');
        }
        try {
          await fireReminderNotification();
        } catch (_) {}
        return;
      }
      const p = notificationState();
      setPerm(p);
      if (p !== 'granted') {
        const next = await requestNotificationPermission();
        setPerm(next);
        if (next !== 'granted') {
          toast.error('Please turn on reminders to see a preview');
          return;
        }
      }
      const result = await fireReminderNotification();
      if (result === 'shown') {
        toast.success("Here is what your reminder will look like 🔔");
      } else {
        toast("Reminder is on — you'll see it here at the set time ⏰");
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSaveName = async () => {
    const clean = username.trim();
    if (clean.length < 3 || clean.length > 30) {
      toast.error('Username must be 3–30 characters');
      return;
    }
    if (clean === user?.username) return;
    setSavingName(true);
    try {
      await updateProfile({ username: clean });
      toast.success('Profile updated ✨');
    } catch (err) {
      toast.error(friendlyServerError(err?.response?.data?.message, 'Could not update your name. Please try again.'));
    } finally {
      setSavingName(false);
    }
  };

  const handleRemovePin = async () => {
    await removePin();
    setPinSet(false);
    toast.success('PIN removed');
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out. See you soon!');
    navigate('/login');
  };

  const currentWallpaperName =
    presets.find((p) => p.id === wallpaper)?.name || (wallpaper === 'custom' ? 'My photo' : wallpaper);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen transition-colors duration-200" style={{ background: 'var(--bg-app)' }}>
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm mb-4 cursor-pointer"
          style={{ color: topMuted }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-display font-bold uppercase flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' }}
          >
            {user?.username ? user.username[0] : 'D'}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl truncate" style={{ color: topInk }}>
              {user?.username || 'Account'}
            </h1>
            <p className="text-xs truncate" style={{ color: topMuted }}>{user?.email || ''}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-ghost)' }}>
              {entryCount === null ? '…' : `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
              {createdAt ? ` · joined ${new Date(createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Profile */}
          <Card icon={User} title="Profile" subtitle="Changing your name won't change your entries">
            <label className="text-[11px] uppercase tracking-widest font-medium" style={{ color: 'var(--text-ghost)' }}>
              Username
            </label>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={30}
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none min-w-0"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={savingName || username.trim() === user?.username}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40 flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' }}
              >
                {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>
            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--text-ghost)' }}>
                Email
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user?.email || '—'}</p>
            </div>
          </Card>

          {/* Reminders */}
          <Card icon={Bell} title="Reminders">
            <Row
              label="Remind me"
              hint={
                reminder.enabled
                  ? `${reminder.times.length} reminder${reminder.times.length === 1 ? '' : 's'}: ${reminder.times.map(formatTime12).join(', ')} · ${phonePush === 'on' ? 'On ✅' : phonePush === 'off' ? 'Off' : '…'}`
                  : 'Off'
              }
              right={
                <button
                  type="button"
                  onClick={handleToggleReminder}
                  disabled={pushBusy}
                  className="w-11 h-6 rounded-full relative transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
                  style={{ background: reminder.enabled ? 'var(--gold)' : 'var(--border-color)' }}
                  aria-label={reminder.enabled ? 'Turn reminder off' : 'Turn reminder on'}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                    style={{ left: reminder.enabled ? '22px' : '2px' }}
                  />
                </button>
              }
            />
            <div className="py-2.5 space-y-2">
              <div className="flex-1">
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  Reminder times · <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{reminder.times.length} set</span>
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-ghost)' }}>
                  {nativeApp
                    ? (nativePerm === 'granted' ? 'Reminders allowed on this phone' : nativePerm === 'denied' ? 'Blocked — allow in phone Settings > Apps > Diary' : "We'll ask for permission when you turn it on")
                    : (perm === 'unsupported' ? "Can't show reminders here" : perm === 'denied' ? 'Blocked — turn on reminders in your browser settings' : perm === 'granted' ? 'Reminders allowed' : "We'll ask for permission when you turn it on")}
                </p>
              </div>
              {reminder.times.map((t) => (
                <div
                  key={t}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
                >
                  <Bell className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--gold)' }} />
                  <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {formatTime12(t)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTime(t)}
                    className="p-1.5 rounded-lg cursor-pointer"
                    style={{ color: 'var(--text-ghost)' }}
                    aria-label={`Remove ${formatTime12(t)} reminder`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {reminder.times.length < MAX_REMINDERS && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value || '21:00')}
                    className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', colorScheme: isDark ? 'dark' : 'light' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTime}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              )}
            </div>
            {phonePush === 'on' && (
              <button
                type="button"
                onClick={handleRemoveDevice}
                className="mt-1 flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
                style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-ghost)' }}
              >
                Stop reminders on this phone
              </button>
            )}
            <button
              type="button"
              onClick={handleTestReminder}
              disabled={testing}
              className="mt-1 flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--gold-glow)', border: '1px solid var(--border-bright)', color: 'var(--gold)' }}
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : reminder.enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
              {testing ? 'Sending preview…' : 'Send a preview'}
            </button>
          </Card>

          {/* Appearance */}
          <Card icon={Palette} title="Appearance" subtitle="Theme and background">
            <Row
              label={isDark ? 'Dark theme' : 'Light theme'}
              hint="Changes right away"
              right={
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
                >
                  {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" style={{ color: '#8a5a12' }} />}
                  Switch
                </button>
              }
            />
            <Row
              label="Background"
              hint={`Current: ${currentWallpaperName}`}
              right={
                <button
                  type="button"
                  onClick={() => setShowWallpaper(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Change
                </button>
              }
            />
          </Card>

          {/* Security */}
          <Card icon={ShieldCheck} title="Security" subtitle="Your PIN only works on this phone">
            <Row
              label="PIN lock"
              hint={pinSet ? 'On for this phone' : 'Off'}
              right={
                pinSet ? (
                  <div className="flex items-center justify-end flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPinModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
                      style={{ background: 'var(--gold-glow)', border: '1px solid var(--border-bright)', color: 'var(--gold)' }}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={handleRemovePin}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
                      style={{ background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)', color: '#e05555' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPinModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
                    style={{ background: 'var(--gold-glow)', border: '1px solid var(--border-bright)', color: 'var(--gold)' }}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Set PIN
                  </button>
                )
              }
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => { lockApp(); toast.success('Diary locked 🔒'); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
              >
                <Lock className="w-3.5 h-3.5" />
                Lock now
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
                style={{ background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)', color: '#e05555' }}
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </Card>
        </div>
      </main>

      <SetPinModal
        isOpen={showPinModal}
        onClose={() => { setShowPinModal(false); setPinSet(Boolean(localStorage.getItem('diary_pin_vault'))); }}
      />
      <WallpaperPicker isOpen={showWallpaper} onClose={() => setShowWallpaper(false)} />
    </div>
  );
}
