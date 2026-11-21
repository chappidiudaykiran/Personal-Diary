import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster, ToastBar } from 'react-hot-toast';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx';
import { WallpaperProvider, useWallpaper } from './context/WallpaperContext.jsx';
import './index.css';

// One-time cleanup of caches from the old hand-written SW (v1/v2/v3)
try {
  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys
        .filter((k) => k.startsWith('diary-static-') || k.startsWith('diary-api-') || k.startsWith('personal-diary-'))
        .forEach((k) => caches.delete(k).catch(() => {}));
    }).catch(() => {});
  }
} catch (_) {}

// Register the push service worker explicitly (idempotent — same /sw.js
// that registerSW.js registers). Fixes `serviceWorker.ready` hanging when
// the auto-register script is cached/blocked, which broke reminders.
try {
  if ('serviceWorker' in navigator) {
    import('@capacitor/core').then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) return;
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
      });
    }).catch(() => {});
  }
} catch (_) {}

// Success-toast accent follows the wallpaper (falls back to gold).
const WALLPAPER_ACCENTS = {
  golden: { bg: '#c4913a', fg: '#0c0c17' },
  ocean: { bg: '#14919b', fg: '#062a30' },
  forest: { bg: '#2d6a4f', fg: '#ffffff' },
  rose: { bg: '#c98a94', fg: '#33101d' },
  lavender: { bg: '#a394e0', fg: '#1e1b4b' },
  midnight: { bg: '#4a5f9e', fg: '#ffffff' },
  dune: { bg: '#e6ac4e', fg: '#231a08' },
  matcha: { bg: '#7fa383', fg: '#0f1a12' },
};
const GOLD_ACCENT = { bg: 'linear-gradient(135deg, #c4913a, #dba84a)', fg: '#0c0c17' };

function ThemedToaster() {
  const { isDark } = useTheme();
  const { wallpaper } = useWallpaper();
  const accent = WALLPAPER_ACCENTS[wallpaper] || GOLD_ACCENT;
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3000,
        // Keep the toast mounted briefly after dismiss so the erase-out
        // animation (see index.css `.diary-toast-erase`) can play fully.
        removeDelay: 450,
        style: isDark
          ? {
              background: '#181828',
              color: '#ede8d8',
              border: 'none',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }
          : {
              background: '#ffffff',
              color: '#1f1b18',
              border: 'none',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            },
        success: {
          style: {
            background: accent.bg,
            color: accent.fg,
            border: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            fontWeight: 600,
          },
          iconTheme: { primary: accent.fg, secondary: 'rgba(255,255,255,0.35)' },
        },
        error: {
          style: isDark
            ? {
                background: '#2a1418',
                color: '#f3b8b8',
                border: 'none',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }
            : {
                background: '#fdecea',
                color: '#8f1d1d',
                border: 'none',
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              },
          iconTheme: { primary: '#e05555', secondary: 'rgba(255,255,255,0.35)' },
        },
      }}
    >
      {(t) => (
        <ToastBar toast={t} position={t.position}>
          {({ icon, message }) => (
            <div className={t.visible ? 'diary-toast' : 'diary-toast diary-toast-erase'}>
              {icon}
              <span>{message}</span>
            </div>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <WallpaperProvider>
          <AuthProvider>
            <App />
            <ThemedToaster />
          </AuthProvider>
        </WallpaperProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
