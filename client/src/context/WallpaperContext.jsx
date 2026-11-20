import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTheme } from './ThemeContext.jsx';
import {
  saveCustomWallpaper,
  loadCustomWallpaper,
  clearCustomWallpaper,
} from '../utils/wallpaperStore.js';

const STORAGE_KEY = 'diary_wallpaper';
const MAX_CUSTOM_BYTES = 10 * 1024 * 1024;

export const PRESET_WALLPAPERS = [
  { id: 'none', name: 'Default', css: null, tone: null },
  { id: 'golden', name: 'Golden Hour', css: 'linear-gradient(160deg, #241533 0%, #7a3b2e 48%, #c4913a 100%)', tone: 'dark' },
  { id: 'ocean', name: 'Ocean', css: 'linear-gradient(160deg, #081a33 0%, #0f4c5c 55%, #14919b 100%)', tone: 'dark' },
  { id: 'forest', name: 'Forest', css: 'linear-gradient(160deg, #0b2317 0%, #1b4332 55%, #2d6a4f 100%)', tone: 'dark' },
  { id: 'rose', name: 'Rosé', css: 'linear-gradient(160deg, #33101d 0%, #7a2b3f 55%, #c98a94 100%)', tone: 'dark' },
  { id: 'lavender', name: 'Lavender', css: 'linear-gradient(160deg, #1e1b4b 0%, #5b4b8a 60%, #a394e0 100%)', tone: 'dark' },
  { id: 'midnight', name: 'Midnight', css: 'radial-gradient(120% 90% at 80% 0%, #2b3a67 0%, #101528 55%, #05070f 100%)', tone: 'dark' },
  { id: 'dune', name: 'Dune', css: 'linear-gradient(160deg, #f7ead0 0%, #e6ac4e 60%, #a5711f 100%)', tone: 'light' },
  { id: 'matcha', name: 'Matcha', css: 'linear-gradient(160deg, #16241a 0%, #3a5a40 60%, #a3b18a 100%)', tone: 'dark' },
];

/** Sample an image's overall brightness: 'light' or 'dark'. */
function analyzeImageTone(file) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const N = 32;
          const c = document.createElement('canvas');
          c.width = N;
          c.height = N;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, N, N);
          const d = ctx.getImageData(0, 0, N, N).data;
          let lum = 0;
          for (let i = 0; i < d.length; i += 4) {
            lum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          }
          lum /= N * N * 255;
          resolve(lum > 0.6 ? 'light' : 'dark');
        } catch (_) {
          resolve('dark');
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('dark');
      };
      img.src = url;
    } catch (_) {
      resolve('dark');
    }
  });
}

const WallpaperContext = createContext(null);

function isValidId(id) {
  return id === 'none' || id === 'custom' || PRESET_WALLPAPERS.some((p) => p.id === id);
}

function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { id: 'none', customTone: 'dark' };
    try {
      const o = JSON.parse(saved);
      if (o && typeof o === 'object') {
        return {
          id: isValidId(o.id) ? o.id : 'none',
          customTone: o.customTone === 'light' ? 'light' : 'dark',
        };
      }
    } catch (_) {
      // Legacy plain-string value
    }
    return { id: isValidId(saved) ? saved : 'none', customTone: 'dark' };
  } catch (_) {
    return { id: 'none', customTone: 'dark' };
  }
}

function persist(id, customTone) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, customTone }));
  } catch (_) {}
}

export function WallpaperProvider({ children }) {
  const [stored, setStored] = useState(readStored);
  const wallpaper = stored.id;
  const [customUrl, setCustomUrl] = useState(null);
  // Theme decides the scrim color (light theme = light wash, dark = dark wash),
  // so text on the wallpaper must follow the theme — not the image brightness.
  // Otherwise a "dark" photo + light theme gives white text on a white wash.
  let isDark = true;
  try {
    isDark = useTheme().isDark;
  } catch (_) {
    isDark = !document.documentElement.classList.contains('light');
  }

  // Load custom image blob into an object URL on mount (and when selected)
  useEffect(() => {
    let cancelled = false;
    let url = null;
    loadCustomWallpaper()
      .then((rec) => {
        if (cancelled) return;
        if (rec?.blob) {
          const blob = rec.blob instanceof Blob ? rec.blob : new Blob([rec.blob], { type: rec.type || 'image/*' });
          url = URL.createObjectURL(blob);
          setCustomUrl(url);
        } else {
          setStored((prev) => {
            if (prev.id === 'custom') {
              // Blob gone (storage cleared) — fall back to default
              persist('none', prev.customTone);
              return { id: 'none', customTone: prev.customTone };
            }
            return prev;
          });
        }
      })
      .catch(() => {
        setStored((prev) => {
          if (!cancelled && prev.id === 'custom') {
            persist('none', prev.customTone);
            return { id: 'none', customTone: prev.customTone };
          }
          return prev;
        });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wallpaper tone drives top-text contrast. null = no wallpaper (follow theme).
  // NOTE: the scrim follows the theme (light theme = light wash), so in light
  // mode the backdrop is always light regardless of image brightness — text
  // must be dark. Only in dark mode do we respect the analyzed image tone.
  const preset = PRESET_WALLPAPERS.find((p) => p.id === wallpaper);
  const rawTone = wallpaper === 'none' ? null : wallpaper === 'custom' ? stored.customTone : preset?.tone || 'dark';
  const tone = !rawTone ? null : isDark ? rawTone : 'light';
  // Ink colors for text sitting directly on the wallpaper.
  // NOTE: muted values stay fairly opaque so small navbar icons keep
  // enough contrast on bright wallpapers / light theme.
  const topInk = !tone ? 'var(--text-primary)' : tone === 'light' ? '#23201c' : '#f5efe4';
  const topMuted = !tone ? 'var(--text-muted)' : tone === 'light' ? 'rgba(35,32,28,0.8)' : 'rgba(245,239,228,0.85)';
  const topGold = !tone ? 'var(--gold)' : tone === 'light' ? '#8a5a12' : '#e0aa4e';

  // Apply wallpaper to the page behind the app. Navbar tone follows the
  // wallpaper (not the theme) so icons stay visible on it.
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const active = PRESET_WALLPAPERS.find((p) => p.id === wallpaper);

    let image = null;
    if (wallpaper === 'custom' && customUrl) {
      image = `linear-gradient(var(--wallpaper-scrim), var(--wallpaper-scrim)), url("${customUrl}")`;
    } else if (active && active.css) {
      image = active.css;
    }

    if (image) {
      root.classList.add('has-wallpaper');
      root.classList.toggle('wallpaper-light', tone === 'light');
      root.classList.toggle('wallpaper-dark', tone !== 'light');
      body.style.backgroundImage = image;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundAttachment = 'fixed';
    } else {
      root.classList.remove('has-wallpaper', 'wallpaper-light', 'wallpaper-dark');
      body.style.backgroundImage = '';
      body.style.backgroundSize = '';
      body.style.backgroundPosition = '';
      body.style.backgroundAttachment = '';
    }
  }, [wallpaper, customUrl, tone]);

  const setWallpaper = useCallback((id) => {
    const next = isValidId(id) ? id : 'none';
    setStored((prev) => {
      persist(next, prev.customTone);
      return { ...prev, id: next };
    });
  }, []);

  const uploadCustom = useCallback(async (file) => {
    if (!file || !file.type?.startsWith('image/')) {
      toast.error('Please choose a photo');
      return false;
    }
    if (file.size > MAX_CUSTOM_BYTES) {
      toast.error('That photo is too big — please choose one under 10 MB');
      return false;
    }
    try {
      const tone = await analyzeImageTone(file);
      await saveCustomWallpaper(file);
      setCustomUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setStored({ id: 'custom', customTone: tone });
      persist('custom', tone);
      toast.success('Background updated ✨');
      return true;
    } catch (_) {
      toast.error("Couldn't save your background. Try again.");
      return false;
    }
  }, []);

  const deleteCustom = useCallback(async () => {
    try {
      await clearCustomWallpaper();
    } catch (_) {}
    setCustomUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setStored((prev) => {
      persist('none', prev.customTone);
      return { ...prev, id: 'none' };
    });
  }, []);

  return (
    <WallpaperContext.Provider
      value={{ wallpaper, setWallpaper, customUrl, uploadCustom, deleteCustom, presets: PRESET_WALLPAPERS, tone, topInk, topMuted, topGold }}
    >
      {children}
    </WallpaperContext.Provider>
  );
}

export function useWallpaper() {
  const ctx = useContext(WallpaperContext);
  if (!ctx) throw new Error('useWallpaper must be used within WallpaperProvider');
  return ctx;
}
