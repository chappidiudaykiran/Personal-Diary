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

/** Typewriter erase: while visible shows full text + blinking caret;
 *  on dismiss deletes characters one-by-one from the end. */
function EraseText({ text, visible, color, shadow }) {
  const [len, setLen] = useState(null); // null = full text
  useEffect(() => {
    if (visible) {
      setLen(null);
      return;
    }
    const full = text.length;
    if (full === 0) return;
    // Erase takes ~0.6s regardless of length (fits inside removeDelay)
    const step = Math.max(6, Math.min(24, Math.floor(600 / full)));
    setLen(full);
    const id = setInterval(() => {
      setLen((l) => {
        if (l === null || l <= 1) {
          clearInterval(id);
          return 0;
        }
        return l - 1;
      });
    }, step);
    return () => clearInterval(id);
  }, [visible, text]);

  const shown = len === null ? text : text.slice(0, len);
  return (
    <span className="diary-toast-text" style={{ color, textShadow: shadow }}>
      {shown}
      <span className={visible ? 'diary-caret diary-caret-blink' : 'diary-caret'} />
    </span>
  );
}

function ThemedToaster() {
  const { isDark } = useTheme();
  const { topGold } = useWallpaper();
  const successColor = topGold || 'var(--gold)';
  const errorColor = isDark ? '#f09696' : '#b3261e';
  const shadow = isDark ? '0 1px 10px rgba(0,0,0,0.65)' : '0 1px 6px rgba(255,255,255,0.7)';
  // Text-only toast: no background, no border, no shadow box
  const naked = {
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    padding: '6px 10px',
  };
  return (
    <Toaster
      position="top-center"
      gutter={8}
      // Sit below the navbar instead of glued to the very top edge
      containerStyle={{ top: 76, left: 16, right: 16 }}
      toastOptions={{
        duration: 3000,
        // Keep the toast mounted so the character erase can finish
        removeDelay: 1000,
        style: { ...naked, color: isDark ? '#ede8d8' : '#1f1b18', fontWeight: 600 },
        success: { style: { ...naked } },
        error: { style: { ...naked } },
      }}
    >
      {(t) => (
        <ToastBar toast={t} position={t.position}>
          {({ message }) => {
            const color = t.type === 'error' ? errorColor : t.type === 'success' ? successColor : isDark ? '#ede8d8' : '#1f1b18';
            return (
              <div className="diary-toast">
                {typeof message === 'string' ? (
                  <EraseText text={message} visible={t.visible} color={color} shadow={shadow} />
                ) : (
                  <span className="diary-toast-text" style={{ color, textShadow: shadow }}>
                    {message}
                  </span>
                )}
              </div>
            );
          }}
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
