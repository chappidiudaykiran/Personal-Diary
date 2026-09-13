import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_AUTOSAVE_PREF_KEY = 'diary_autosave_enabled';

export function useAutoSave({ draftId = 'new_entry', data = {}, onRestore }) {
  const { user } = useAuth();
  const userId = user?._id || 'guest';
  const storageKey = `diary_draft_${userId}_${draftId}`;

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    const saved = localStorage.getItem(DEFAULT_AUTOSAVE_PREF_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'disabled' | 'restored'
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  const initialCheckDoneRef = useRef(false);
  const isFirstRender = useRef(true);

  // Toggle auto-save setting
  const toggleAutoSave = useCallback(() => {
    setAutoSaveEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(DEFAULT_AUTOSAVE_PREF_KEY, JSON.stringify(next));
      if (!next) setStatus('disabled');
      return next;
    });
  }, []);

  // Check and restore existing draft on initial load
  useEffect(() => {
    if (initialCheckDoneRef.current) return;
    initialCheckDoneRef.current = true;

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
    }
  }, [storageKey, onRestore]);

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

  // Debounced auto-save effect
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!autoSaveEnabled) {
      setStatus('disabled');
      return;
    }

    const { title, content, mood } = data;
    const hasData = Boolean(title?.trim() || content?.trim() || mood);

    if (!hasData) {
      clearDraft();
      return;
    }

    setStatus('saving');

    const timer = setTimeout(() => {
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
        console.error('Failed to auto-save draft', e);
        setStatus('idle');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [data.title, data.content, data.mood, autoSaveEnabled, storageKey, clearDraft]);

  return {
    autoSaveEnabled,
    toggleAutoSave,
    status,
    lastSavedAt,
    hasRestoredDraft,
    clearDraft,
    setHasRestoredDraft,
  };
}
