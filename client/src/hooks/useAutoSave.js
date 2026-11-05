import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_AUTOSAVE_PREF_KEY = 'diary_autosave_enabled';

export function useAutoSave({ draftId = 'new_entry', data = {} }) {
  const { user } = useAuth();
  const userId = user?.id || user?._id || 'guest';
  const storageKey = `diary_draft_${userId}_${draftId}`;

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(DEFAULT_AUTOSAVE_PREF_KEY);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'disabled' | 'restored'
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Set by clearDraft() so the unmount/beforeunload save below does not
  // resurrect a draft that was just saved or discarded.
  const suppressSaveRef = useRef(false);
  // Skip the very first autosave run so a just-restored draft isn't
  // pointlessly rewritten (and 'restored' status isn't clobbered) on mount.
  const firstRunRef = useRef(true);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Toggle auto-save setting
  const toggleAutoSave = useCallback(() => {
    setAutoSaveEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DEFAULT_AUTOSAVE_PREF_KEY, JSON.stringify(next));
      } catch (_) {}
      if (!next) setStatus('disabled');
      return next;
    });
  }, []);

  // Clear draft from storage
  const clearDraft = useCallback(() => {
    suppressSaveRef.current = true;
    try {
      localStorage.removeItem(storageKey);
      setStatus('idle');
      setLastSavedAt(null);
      setHasRestoredDraft(false);
    } catch (e) {
      console.error('Failed to clear draft', e);
    }
  }, [storageKey]);

  // Synchronous save helper
  const saveNow = useCallback((currentData) => {
    if (suppressSaveRef.current) return;
    const { title, content, mood } = currentData || dataRef.current || {};
    const hasData = Boolean(title?.trim() || content?.trim() || mood);
    if (!hasData) return;

    try {
      const now = new Date();
      const draftObj = {
        title: title || '',
        content: content || '',
        mood: mood || '',
        savedAt: now.toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(draftObj));
      setLastSavedAt(now);
      setStatus('saved');
    } catch (e) {
      console.error('Failed to save draft', e);
    }
  }, [storageKey]);

  // Called by the screen after it synchronously restores a draft into state.
  const markRestored = useCallback((savedAt) => {
    setHasRestoredDraft(true);
    setLastSavedAt(savedAt ? new Date(savedAt) : new Date());
    setStatus('restored');
  }, []);

  // Debounced auto-save effect when data changes
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }

    if (!autoSaveEnabled) {
      setStatus('disabled');
      return;
    }

    const { title, content, mood } = data;
    const hasData = Boolean(title?.trim() || content?.trim() || mood);

    if (!hasData) {
      return;
    }

    // Typing new content after a clear re-enables auto-save for that content
    suppressSaveRef.current = false;
    setStatus('saving');

    const timer = setTimeout(() => {
      saveNow(data);
    }, 400); // 400ms fast debounce

    return () => clearTimeout(timer);
  }, [data.title, data.content, data.mood, autoSaveEnabled, saveNow]);

  // Save draft immediately on window unload (closing tab or refreshing) or unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (autoSaveEnabled) {
        saveNow(dataRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (autoSaveEnabled) {
        saveNow(dataRef.current);
      }
    };
  }, [autoSaveEnabled, saveNow]);

  return {
    autoSaveEnabled,
    toggleAutoSave,
    status,
    lastSavedAt,
    hasRestoredDraft,
    clearDraft,
    setHasRestoredDraft,
    saveNow,
    markRestored,
    storageKey,
  };
}
