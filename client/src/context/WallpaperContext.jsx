import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  saveCustomWallpaper,
  loadCustomWallpaper,
  clearCustomWallpaper,
} from '../utils/wallpaperStore.js';

const STORAGE_KEY = 'diary_wallpaper';
const MAX_CUSTOM_BYTES = 5 * 1024 * 1024;

export const PRESET_WALLPAPERS = [
  { id: 'none', name: 'Default', css: null },
  { id: 'golden', name: 'Golden Hour', css: 'linear-gradient(160deg, #241533 0%, #7a3b2e 48%, #c4913a 100%)' },
  { id: 'ocean', name: 'Ocean', css: 'linear-gradient(160deg, #081a33 0%, #0f4c5c 55%, #14919b 100%)' },
  { id: 'forest', name: 'Forest', css: 'linear-gradient(160deg, #0b2317 0%, #1b4332 55%, #2d6a4f 100%)' },
  { id: 'rose', name: 'Rosé', css: 'linear-gradient(160deg, #33101d 0%, #7a2b3f 55%, #c98a94 100%)' },
  { id: 'lavender', name: 'Lavender', css: 'linear-gradient(160deg, #1e1b4b 0%, #5b4b8a 60%, #a394e0 100%)' },
  { id: 'midnight', name: 'Midnight', css: 'radial-gradient(120% 90% at 80% 0%, #2b3a67 0%, #101528 55%, #05070f 100%)' },
  { id: 'dune', name: 'Dune', css: 'linear-gradient(160deg, #f7ead0 0%, #e6ac4e 60%, #a5711f 100%)' },
  { id: 'matcha', name: 'Matcha', css: 'linear-gradient(160deg, #16241a 0%, #3a5a40 60%, #a3b18a 100%)' },
];

const WallpaperContext = createContext(null);

function readStoredId() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return 'none';
    if (saved === 'none' || saved === 'custom') return saved;
    return PRESET_WALLPAPERS.some((p) => p.id === saved) ? saved : 'none';
  } catch (_) {
    return 'none';
  }
}

export function WallpaperProvider({ children }) {
  const [wallpaper, setWallpaperState] = useState(readStoredId);
  const [customUrl, setCustomUrl] = useState(null);

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
        } else if (readStoredId() === 'custom') {
          // Blob gone (storage cleared) — fall back to default
          setWallpaperState('none');
          try { localStorage.setItem(STORAGE_KEY, 'none'); } catch (_) {}
        }
      })
      .catch(() => {
        if (!cancelled && readStoredId() === 'custom') {
          setWallpaperState('none');
          try { localStorage.setItem(STORAGE_KEY, 'none'); } catch (_) {}
        }
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply wallpaper to the page behind the app
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const preset = PRESET_WALLPAPERS.find((p) => p.id === wallpaper);

    if (wallpaper === 'custom' && customUrl) {
      root.classList.add('has-wallpaper');
      body.style.backgroundImage = `linear-gradient(var(--wallpaper-scrim), var(--wallpaper-scrim)), url("${customUrl}")`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundAttachment = 'fixed';
    } else if (preset && preset.css) {
      root.classList.add('has-wallpaper');
      body.style.backgroundImage = preset.css;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundAttachment = 'fixed';
    } else {
      root.classList.remove('has-wallpaper');
      body.style.backgroundImage = '';
      body.style.backgroundSize = '';
      body.style.backgroundPosition = '';
      body.style.backgroundAttachment = '';
    }
  }, [wallpaper, customUrl]);

  const setWallpaper = useCallback((id) => {
    const valid = id === 'custom' || PRESET_WALLPAPERS.some((p) => p.id === id);
    const next = valid ? id : 'none';
    setWallpaperState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) {}
  }, []);

  const uploadCustom = useCallback(async (file) => {
    if (!file || !file.type?.startsWith('image/')) {
      toast.error('Please choose an image file');
      return false;
    }
    if (file.size > MAX_CUSTOM_BYTES) {
      toast.error('Image is too large (max 5 MB)');
      return false;
    }
    try {
      await saveCustomWallpaper(file);
      setCustomUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setWallpaperState('custom');
      try {
        localStorage.setItem(STORAGE_KEY, 'custom');
      } catch (_) {}
      toast.success('Wallpaper set ✨');
      return true;
    } catch (_) {
      toast.error('Could not save wallpaper on this device');
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
    setWallpaperState('none');
    try {
      localStorage.setItem(STORAGE_KEY, 'none');
    } catch (_) {}
  }, []);

  return (
    <WallpaperContext.Provider
      value={{ wallpaper, setWallpaper, customUrl, uploadCustom, deleteCustom, presets: PRESET_WALLPAPERS }}
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
