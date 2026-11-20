import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Bell, BellOff, Palette, ShieldCheck, KeyRound,
  Lock, LogOut, Save, Loader2, Image as ImageIcon, Sun, Moon, Trash2,
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
  notificationState,
  requestNotificationPermission,
  fireReminderNotification,
} from '../utils/reminder.js';

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
  const [perm, setPerm] = useState('default');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setPerm(notificationState());
    // Refresh profile (createdAt) + entry count
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

  const persistReminder = (next) => {
    setReminder(saveReminderSettings(next));
  };

  const handleToggleReminder = async () => {
    if (!reminder.enabled) {
      // Enabling — need permission first
      let p = notificationState();
      if (p === 'unsupported') {
        toast.error('Notifications are not supported in this browser');
        return;
      }
      if (p !== 'granted') {
        p = await requestNotificationPermission();
        setPerm(p);
        if (p !== 'granted') {
          toast.error('Allow notifications to enable reminders');
          return;
        }
      }
      persistReminder({ enabled: true });
      toast.success(`Daily reminder set for ${reminder.time} ✅`);
    } else {
      persistReminder({ enabled: false });
      toast.success('Daily reminder turned off');
    }
  };

  const handleTestReminder = async () => {
    setTesting(true);
    try {
      const p = notificationState();
      setPerm(p);
      if (p !== 'granted') {
        const next = await requestNotificationPermission();
        setPerm(next);
        if (next !== 'granted') {
          toast.error('Allow notifications to preview the reminder');
          return;
        }
      }
      await fireReminderNotification();
      toast.success('Reminder preview sent 🔔');
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
      toast.error(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingName(false);
    }
  };

  const handleRemovePin = async () => {
    await removePin();
    setPinSet(false);
    toast.success('PIN removed from this device');
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Goodbye!');
    navigate('/login');
  };

  const currentWallpaperName =
    presets.find((p) => p.id === wallpaper)?.name || (wallpaper === 'custom' ? 'My photo' : wallpaper);

  return (
    <div className="min-h-screen transition-colors duration-200" style={{ background: 'var(--bg-app)' }}>
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <button
          onClick={() => navigate(-1)}
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
          <Card icon={User} title="Profile" subtitle="Username is safe to change — encryption is untouched">
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

          {/* Daily reminder */}
          <Card icon={Bell} title="Daily reminder" subtitle="Nudges you to write — fires while the app is open or installed">
            <Row
              label="Remind me every day"
              hint={reminder.enabled ? `Fires once a day after ${reminder.time}` : 'Off'}
              right={
                <button
                  type="button"
                  onClick={handleToggleReminder}
                  className="w-11 h-6 rounded-full relative transition-colors cursor-pointer flex-shrink-0"
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
            <div className="flex items-center gap-2 py-2.5">
              <div className="flex-1">
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Reminder time</p>
                <p className="text-[11px]" style={{ color: 'var(--text-ghost)' }}>
                  {perm === 'unsupported' ? 'Not supported in this browser' : perm === 'denied' ? 'Blocked — enable in browser site settings' : perm === 'granted' ? 'Notifications allowed' : 'Permission will be asked when you enable'}
                </p>
              </div>
              <input
                type="time"
                value={reminder.time}
                onChange={(e) => persistReminder({ time: e.target.value || '21:00' })}
                className="px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', colorScheme: isDark ? 'dark' : 'light' }}
              />
            </div>
            <button
              type="button"
              onClick={handleTestReminder}
              disabled={testing}
              className="mt-1 flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--gold-glow)', border: '1px solid var(--border-bright)', color: 'var(--gold)' }}
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : reminder.enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
              {testing ? 'Sending…' : 'Send test notification'}
            </button>
          </Card>

          {/* Appearance */}
          <Card icon={Palette} title="Appearance" subtitle="Theme and background">
            <Row
              label={isDark ? 'Dark mode' : 'Light mode'}
              hint="Applies instantly"
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
              label="Wallpaper"
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
          <Card icon={ShieldCheck} title="Security" subtitle="PIN lock lives only on this device">
            <Row
              label="PIN lock"
              hint={pinSet ? 'Set on this device' : 'Not set'}
              right={
                pinSet ? (
                  <button
                    type="button"
                    onClick={handleRemovePin}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
                    style={{ background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)', color: '#e05555' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
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
