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

// Wallpaper accent as a plain hex so we can tint the toast background.
const ACCENT_HEX = {
  golden: '#c4913a',
  ocean: '#14919b',
  forest: '#2d6a4f',
  rose: '#c98a94',
  lavender: '#a394e0',
  midnight: '#4a5f9e',
  dune: '#e6ac4e',
  matcha: '#7fa383',
};

const hexToRgba = (hex, a) => {
  const h = (hex || '#c4913a').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

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
  const { topGold, wallpaper } = useWallpaper();
  const successColor = topGold || 'var(--gold)';
  const errorColor = isDark ? '#f09696' : '#b3261e';
  const shadow = isDark ? '0 1px 10px rgba(0,0,0,0.65)' : '0 1px 6px rgba(255,255,255,0.7)';
  const accentHex = ACCENT_HEX[wallpaper] || '#c4913a';
  // Very light gradient wash tinted by type — text stays the readable part
  const naked = (tint) => ({
    background: `linear-gradient(135deg, ${hexToRgba(tint, isDark ? 0.22 : 0.14)}, ${hexToRgba(tint, isDark ? 0.1 : 0.06)})`,
    border: 'none',
    borderRadius: 12,
    boxShadow: 'none',
    padding: '8px 14px',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  });
  const neutral = isDark ? '#ffffff' : '#000000';
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
        style: { ...naked(neutral), color: isDark ? '#ede8d8' : '#1f1b18', fontWeight: 600 },
        success: { style: { ...naked(accentHex) } },
        error: { style: { ...naked('#e05555') } },
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
