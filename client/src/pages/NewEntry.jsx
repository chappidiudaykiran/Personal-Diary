import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import BlockEditor from '../components/BlockEditor.jsx';
import { uploadMediaFile } from '../api/mediaApi.js';
import apiClient from '../api/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { encrypt } from '../crypto/cryptoUtils.js';
import { useAutoSave } from '../hooks/useAutoSave.js';
import { useKeyboardOpen } from '../hooks/useKeyboardOpen.js';
import { useWallpaper } from '../context/WallpaperContext.jsx';
import { friendlyServerError } from '../utils/friendlyError.js';
import { saveDraftBlobs, loadDraftBlobs, clearDraftBlobs } from '../utils/draftMediaStore.js';
import {
  todayLocalKey,
  isValidDateKey,
  dateKeyToISO,
  formatDateKey,
} from '../utils/entryDate.js';
import {
  createTextBlock,
  createMediaBlock,
  serializeBlocks,
  countBlockWords,
  blocksToPlainText,
  hasBlockContent,
  normalizeBlocks,
  blocksToDraftString,
  draftStringToBlocks,
} from '../utils/entryBlocks.js';

export default function NewEntry() {
  const { cryptoKey, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [uploadStatus, setUploadStatus] = useState('');
  const [saving, setSaving] = useState(false);
  // While the keyboard is open, hide footer + editor toolbar so typed text is fully visible
  const keyboardOpen = useKeyboardOpen();
  const { topInk, topMuted } = useWallpaper();

  const userId = user?.id || user?._id || 'guest';
  const draftKey = `diary_draft_${userId}_new_entry`;
  const todayKey = todayLocalKey();
  // ?date=YYYY-MM-DD pre-selects the day (from the dashboard's day filter).
  // Invalid or future dates fall back to today.
  const paramDate = searchParams.get('date');
  const initialDateKey =
    isValidDateKey(paramDate) && paramDate <= todayKey ? paramDate : todayKey;

  // Synchronous first-render restore from localStorage — no effect timing
  // involved, so a saved draft can never be missed. Image blobs resolve async below.
  const [initialDraft] = useState(() => {
    try {
      const stored = localStorage.getItem(draftKey);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (!parsed || !(parsed.title?.trim() || parsed.content?.trim() || parsed.mood)) return null;
      return parsed;
    } catch {
      return null;
    }
  });

  const [title, setTitle] = useState(initialDraft?.title || '');
  const [mood, setMood] = useState(initialDraft?.mood || '');
  // The diary day this entry belongs to — defaults to today, but any past
  // day can be picked to backfill a missed day.
  const [entryDate, setEntryDate] = useState(() =>
    isValidDateKey(initialDraft?.entryDate) && initialDraft.entryDate <= todayKey
      ? initialDraft.entryDate
      : initialDateKey
  );
  const [blocks, setBlocks] = useState(() => {
    if (initialDraft?.content) {
      try {
        const r = draftStringToBlocks(initialDraft.content);
        if (r?.blocks?.length) return normalizeBlocks(r.blocks);
      } catch (_) {}
    }
    return normalizeBlocks([createTextBlock('')]);
  });
  // False while restored image markers still await their IndexedDB blobs.
  // Blob persisting stays paused until this resolves so it can't wipe them.
  const [mediaResolved, setMediaResolved] = useState(() => {
    if (!initialDraft?.content) return true;
    try {
      const r = draftStringToBlocks(initialDraft.content);
      return !(r?.pending?.length);
    } catch (_) {
      return true;
    }
  });

  // Automatic saving draft: text/title/mood -> localStorage, pending image blobs -> IndexedDB.
  const draftContent = useMemo(() => blocksToDraftString(blocks), [blocks]);

  const { clearDraft, markRestored } = useAutoSave({
    draftId: 'new_entry',
    data: { title, content: draftContent, mood, entryDate },
  });

  // Mount: announce restore + resolve pending image markers against IndexedDB.
  useEffect(() => {
    if (!initialDraft) return;
    markRestored(initialDraft.savedAt);
    let pending = [];
    try {
      pending = draftStringToBlocks(initialDraft.content)?.pending || [];
    } catch (_) {
      pending = [];
    }
    if (pending.length === 0) {
      toast.success('Your unsaved entry is back');
      setMediaResolved(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const blobs = await loadDraftBlobs(draftKey);
        if (cancelled) return;
        const byId = new Map((blobs || []).map((b) => [b.id, b]));
        const found = pending.filter((m) => byId.get(m.id)?.blob).length;
        setBlocks((prev) =>
          normalizeBlocks(
            prev
              .map((b) => {
                if (b.type === 'media' && b.pendingId) {
                  const hit = byId.get(b.pendingId);
                  if (hit?.blob) {
                    const file =
                      hit.blob instanceof File
                        ? hit.blob
                        : new File([hit.blob], hit.name || b.pendingName || 'file', hit.type ? { type: hit.type } : undefined);
                    return createMediaBlock({ file, layout: b.layout, width: b.width });
                  }
                  return null; // blob gone — drop marker
                }
                return b;
              })
              .filter(Boolean)
          )
        );
        if (found === pending.length) {
          toast.success(`Welcome back — your unsaved entry is back with ${found} photo${found === 1 ? '' : 's'} ✨`);
        } else if (found > 0) {
          toast(`Your unsaved entry is back — ${pending.length - found} image${pending.length - found === 1 ? '' : 's'} need to be added again`, { icon: '🖼️' });
        } else {
          toast(`Your unsaved entry is back — ${pending.length} image${pending.length === 1 ? '' : 's'} need to be added again`, { icon: '🖼️' });
        }
      } catch (_) {
        if (!cancelled) {
          setBlocks((prev) => normalizeBlocks(prev.filter((b) => !(b.type === 'media' && b.pendingId))));
          toast(`Your unsaved entry is back — images need to be added again`, { icon: '🖼️' });
        }
      } finally {
        if (!cancelled) setMediaResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only: initialDraft/draftKey are first-render values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist pending file blobs to IndexedDB (debounced). Rewrites the whole set,
  // so removing an image also removes its blob. Keyed on file identity only —
  // typing text does not rewrite blobs. Paused until restored markers resolve.
  const pendingSig = useMemo(
    () =>
      blocks
        .filter((b) => b.type === 'media' && b.file)
        .map((b) => `${b.tempId || b.key}:${b.file.name}:${b.file.size}:${b.file.lastModified}`)
        .join('|'),
    [blocks]
  );

  useEffect(() => {
    if (!mediaResolved) return;
    const pend = blocks.filter((b) => b.type === 'media' && b.file);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        if (!cancelled) {
          await saveDraftBlobs(
            draftKey,
            pend.map((b) => ({ id: b.tempId || b.key, file: b.file }))
          );
        }
      } catch (_) {}
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSig, draftKey, mediaResolved]);

  const encryptEntry = async (blocksToSave) => {
    const { ciphertext: encryptedTitle, iv: titleIv } = await encrypt(cryptoKey, title.trim());
    const { ciphertext: encryptedContent, iv: contentIv } = await encrypt(
      cryptoKey,
      serializeBlocks(blocksToSave)
    );
    return {
      encryptedTitle,
      encryptedContent,
      iv: titleIv,
      ivContent: contentIv,
      mood,
      wordCount: countBlockWords(blocksToSave),
      entryDate: dateKeyToISO(entryDate),
    };
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!cryptoKey) {
      toast.error('You were signed out. Please sign in again to open your diary.');
      return;
    }
    if (!title.trim()) {
      toast.error('Please add a title for your entry');
      return;
    }
    if (!hasBlockContent(blocks)) {
      toast.error('Your diary entry is empty');
      return;
    }

    setSaving(true);
    try {
      // 1. Create the entry (media blocks carry temporary ids for now)
      const { data } = await apiClient.post('/entries', await encryptEntry(blocks));
      const entryId = data.entry?._id;
      if (!entryId) throw new Error('Could not create your entry');

      // 2. Encrypt + upload each inserted file, then point the blocks at the real ids
      const pending = blocks.filter((b) => b.type === 'media' && b.file);
      let failedUploads = 0;
      let finalBlocks = blocks;

      if (pending.length > 0) {
        finalBlocks = [...blocks];
        for (let i = 0; i < pending.length; i++) {
          const block = pending[i];
          try {
            setUploadStatus(`Saving photo ${i + 1} of ${pending.length}: ${block.file.name}`);
            const media = await uploadMediaFile(cryptoKey, entryId, block.file);
            finalBlocks = finalBlocks.map((b) =>
              b.key === block.key ? { ...b, mediaId: media._id, tempId: null, file: null } : b
            );
          } catch (uploadErr) {
            failedUploads++;
            console.error('Media upload failed:', uploadErr);
            finalBlocks = finalBlocks.filter((b) => b.key !== block.key);
          }
        }
        setUploadStatus('');

        // 3. Save the final block order with real media ids
        await apiClient.put(`/entries/${entryId}`, await encryptEntry(normalizeBlocks(finalBlocks)));
      }

      if (failedUploads > 0) {
        toast.error(`Entry saved, but ${failedUploads} photo${failedUploads === 1 ? '' : 's'} could not be saved`);
      } else {
        toast.success('Entry saved ✨');
      }
      clearDraft();
      try { await clearDraftBlobs(draftKey); } catch (_) {}
      navigate(`/entry/${entryId}`);
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg = friendlyServerError(
        err?.response?.data?.message || err?.response?.data?.errors?.[0]?.msg,
        ''
      );
      console.error('Save entry failed:', {
        status,
        data: err?.response?.data,
        code: err?.code,
        message: err?.message,
      });
      if (err?.code === 'ECONNABORTED') {
        toast.error('Waking up your diary… please wait about 30 seconds and try again.');
      } else if (status === 401) {
        toast.error('You were signed out. Please sign in again.');
      } else if (status === 413) {
        toast.error('This entry is too big. Try removing some photos or shortening text.');
      } else if (serverMsg) {
        toast.error(serverMsg);
      } else if (!err?.response) {
        toast.error("Can't reach your diary. Check your internet and try again.");
      } else {
        toast.error('Could not save entry. Please try again.');
      }
    } finally {
      setSaving(false);
      setUploadStatus('');
    }
  };

  const isToday = entryDate === todayKey;
  const dateLabel = isToday
    ? new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : formatDateKey(entryDate);

  return (
    <div className="h-dvh flex flex-col overflow-hidden transition-colors duration-200" style={{ background: 'var(--bg-app)' }}>
      <main className="flex-1 min-h-0 w-full mx-auto flex flex-col px-0 py-0">

        <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col">
          <div
            className="flex-1 min-h-0 flex flex-col overflow-hidden fade-up shadow-sm relative"
            style={{
              background: 'var(--panel-gradient)',
              border: 'none',
            }}
          >
            {/* Gold top accent */}
            <div
              className="h-px flex-shrink-0"
              style={{ background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }}
            />

            {/* Date header — tap the day picker to write for a past day */}
            <div
              className="px-3 pt-4 pb-3 flex-shrink-0 flex items-center gap-2 flex-wrap"
              style={{ borderBottom: '1px solid var(--border-color)' }}
            >
              <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--gold)' }} />
              <p className="text-[11px] sm:text-xs uppercase tracking-widest font-medium" style={{ color: topMuted }}>
                {dateLabel}
              </p>
              {!isToday && (
                <span
                  className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--gold-glow)', color: 'var(--gold)', border: '1px solid var(--border-bright)' }}
                >
                  Backdated entry
                </span>
              )}
              {/* Visible label is ours (theme-aware); the native date input
                  sits invisibly on top so tapping opens the OS day picker. */}
              <div
                className="relative ml-auto rounded-lg px-2 py-1 text-[11px] sm:text-xs cursor-pointer"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                title="Pick the day this entry belongs to"
              >
                <span>📅 Change day</span>
                <input
                  type="date"
                  value={entryDate}
                  max={todayKey}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (isValidDateKey(v) && v <= todayKey) setEntryDate(v);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{ colorScheme: 'dark' }}
                  title="Pick the day this entry belongs to"
                />
              </div>
            </div>

            {/* Writing area — title scrolls together with the text; only this part scrolls */}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-6 scroll-pb-32 sm:scroll-pb-28" style={{ WebkitOverflowScrolling: 'touch' }}>
              {/* Title input */}
              <div className="pt-4 pb-1">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Entry title…"
                  maxLength={200}
                  className="w-full outline-none bg-transparent font-display text-2xl sm:text-3xl transition-colors"
                  style={{ color: topInk, fontWeight: 400 }}
                />
              </div>

              <div className="my-2" style={{ height: '1px', background: 'var(--border-color)' }} />

              <BlockEditor blocks={blocks} onChange={setBlocks} cryptoKey={cryptoKey} disabled={saving} hideToolbar={keyboardOpen} mood={mood} onMoodChange={setMood} />
            </div>

            {/* Upload progress — only shows while photos are saving */}
            {uploadStatus && (
              <p className="flex items-center gap-2 text-xs px-4 sm:px-8 py-2 flex-shrink-0" style={{ color: 'var(--gold)', borderTop: '1px solid var(--border-color)' }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {uploadStatus}
              </p>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
