import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_AUTOSAVE_PREF_KEY = 'diary_autosave_enabled';

export function useAutoSave({ draftId = 'new_entry', data = {}, onRestore }) {
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

  const isInitializedRef = useRef(false);
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

  // 1. Initial check and restore existing draft on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.title?.trim() || parsed.content?.trim() || parsed.mood)) {
          setHasRestoredDraft(true);
          setLastSavedAt(parsed.savedAt ? new Date(parsed.savedAt) : new Date());
          setStatus('restored');
          if (onRestore) {
            onRestore(parsed);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load auto-saved draft', e);
    } finally {
      // Mark initialization complete after restoration callback has fired
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 150);
    }
  }, [storageKey]); // Run on mount / storageKey change

  // 2. Debounced auto-save effect when data changes
  useEffect(() => {
    if (!isInitializedRef.current) return;

    if (!autoSaveEnabled) {
      setStatus('disabled');
      return;
    }

    const { title, content, mood } = data;
    const hasData = Boolean(title?.trim() || content?.trim() || mood);

    if (!hasData) {
      return;
    }

    setStatus('saving');

    const timer = setTimeout(() => {
      saveNow(data);
    }, 400); // 400ms fast debounce

    return () => clearTimeout(timer);
  }, [data.title, data.content, data.mood, autoSaveEnabled, saveNow]);

  // 3. Save draft immediately on window unload (closing tab or refreshing) or unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (autoSaveEnabled && isInitializedRef.current) {
        saveNow(dataRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (autoSaveEnabled && isInitializedRef.current) {
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
  };
}
