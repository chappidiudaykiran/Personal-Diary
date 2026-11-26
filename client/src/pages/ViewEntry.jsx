import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Pencil, Trash2, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { moodMap } from '../components/MoodPicker.jsx';
import BlockEditor from '../components/BlockEditor.jsx';
import EntryContent from '../components/InlineMedia.jsx';
import { uploadMediaFile, listMedia, deleteMedia } from '../api/mediaApi.js';
import apiClient from '../api/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { encrypt, decrypt } from '../crypto/cryptoUtils.js';
import { useKeyboardOpen } from '../hooks/useKeyboardOpen.js';
import { useWallpaper } from '../context/WallpaperContext.jsx';
import { friendlyServerError } from '../utils/friendlyError.js';
import {
  parseEntryContent,
  serializeBlocks,
  countBlockWords,
  hasBlockContent,
  referencedMediaIds,
  normalizeBlocks,
  cloneBlocks,
  createMediaBlock,
} from '../utils/entryBlocks.js';

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ViewEntry() {
  const { id } = useParams();
  const { cryptoKey } = useAuth();
  const navigate = useNavigate();

  const [entry, setEntry] = useState(null);
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [mood, setMood] = useState('');
  const [initialTitle, setInitialTitle] = useState('');
  const [initialBlocks, setInitialBlocks] = useState([]);
  const [initialMood, setInitialMood] = useState('');
  const [savedMediaIds, setSavedMediaIds] = useState([]);
  const [mediaMetas, setMediaMetas] = useState({});
  const [mediaReady, setMediaReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  // Hide footer + toolbar while typing so text stays clearly visible
  const keyboardOpen = useKeyboardOpen();
  const { topInk, topMuted } = useWallpaper();

  // Guards the background media merge below (avoids touching blocks mid-edit)
  const editingRef = useRef(false);
  editingRef.current = editing;

  // ─── Load & decrypt entry ──────────────────────────────────────────────────
  // Two phases: paint title + text immediately after decrypt, then fill in
  // media metas (and any legacy unreferenced attachments) in the background.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await apiClient.get(`/entries/${id}`);
        if (cancelled) return;
        setEntry(data.entry);
        setMood(data.entry.mood || '');
        setInitialMood(data.entry.mood || '');

        const [decTitle, decContent] = await Promise.all([
          decrypt(cryptoKey, data.entry.encryptedTitle, data.entry.iv),
          decrypt(cryptoKey, data.entry.encryptedContent, data.entry.ivContent),
        ]);
        if (cancelled) return;
        setTitle(decTitle);
        setInitialTitle(decTitle);

        const parsed = parseEntryContent(decContent);
        const normalized = normalizeBlocks(parsed);
        setBlocks(normalized);
        setInitialBlocks(cloneBlocks(normalized));
        setLoading(false);

        // Phase 2 — media list (entry is already visible; media fills in)
        try {
          const metas = await listMedia(id);
          if (cancelled) return;
          const byId = {};
          for (const m of metas) byId[m._id] = m;
          setMediaMetas(byId);
          setSavedMediaIds(metas.map((m) => m._id));
          const referenced = referencedMediaIds(parsed);
          const unreferenced = metas.filter((m) => !referenced.has(m._id));
          if (unreferenced.length > 0 && !editingRef.current) {
            const extra = unreferenced.map((m) => createMediaBlock({ mediaId: m._id }));
            setBlocks((prev) => normalizeBlocks([...prev, ...extra]));
            setInitialBlocks((prev) => normalizeBlocks([...prev, ...extra]));
          }
        } catch (_) {
          // Attachments are optional — the entry itself already loads
        }
        if (!cancelled) setMediaReady(true);
      } catch (err) {
        if (cancelled) return;
        toast.error('Could not open this entry. Please try again.');
        navigate('/dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (cryptoKey) {
      setMediaReady(false);
      setMediaMetas({});
      load();
    } else {
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [id, cryptoKey, navigate]);

  const encryptEntry = async (blocksToSave) => {
    const { ciphertext: encryptedTitle, iv } = await encrypt(cryptoKey, title.trim());
    const { ciphertext: encryptedContent, iv: ivContent } = await encrypt(
      cryptoKey,
      serializeBlocks(blocksToSave)
    );
    return {
      encryptedTitle,
      encryptedContent,
      iv,
      ivContent,
      mood,
      wordCount: countBlockWords(blocksToSave),
      // Keep the diary day unchanged when editing text/mood.
      ...(entry?.entryDate ? { entryDate: entry.entryDate } : {}),
    };
  };

  // ─── Save edited entry ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!cryptoKey) {
      toast.error('You were signed out. Please sign in again to open your diary.');
      return;
    }
    if (!title.trim()) {
      toast.error('Please add a title for your entry');
      return;
    }
    if (!hasBlockContent(blocks)) {
      toast.error('Your entry is empty — add some writing or photos');
      return;
    }
    setSaving(true);
    try {
      // 1. Encrypt + upload newly inserted files
      const pending = blocks.filter((b) => b.type === 'media' && b.file);
      let failedUploads = 0;
      let finalBlocks = [...blocks];

      for (let i = 0; i < pending.length; i++) {
        const block = pending[i];
        try {
          setUploadStatus(`Saving photo ${i + 1} of ${pending.length}: ${block.file.name}`);
          const media = await uploadMediaFile(cryptoKey, id, block.file);
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
      finalBlocks = normalizeBlocks(finalBlocks);

      // 2. Save the entry with the final block order
      const { data } = await apiClient.put(`/entries/${id}`, await encryptEntry(finalBlocks));
      setEntry(data.entry);

      // 3. Delete saved media whose blocks were removed while editing.
      // Only when the media list finished loading — otherwise every saved
      // photo would look "removed".
      const stillReferenced = referencedMediaIds(finalBlocks);
      if (mediaReady) {
        const removedIds = savedMediaIds.filter((mediaId) => !stillReferenced.has(mediaId));
        if (removedIds.length > 0) {
          await Promise.allSettled(removedIds.map((mediaId) => deleteMedia(mediaId)));
        }
      }

      setBlocks(finalBlocks);
      setInitialBlocks(cloneBlocks(finalBlocks));
      setInitialTitle(title);
      setInitialMood(mood);
      setSavedMediaIds([...stillReferenced]);
      setEditing(false);

      if (failedUploads > 0) {
        toast.error(`Entry updated, but ${failedUploads} photo${failedUploads === 1 ? '' : 's'} could not be saved`);
      } else {
        toast.success('Entry updated ✨');
      }
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg = friendlyServerError(
        err?.response?.data?.message || err?.response?.data?.errors?.[0]?.msg,
        ''
      );
      console.error('Update entry failed:', {
        status,
        data: err?.response?.data,
        code: err?.code,
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
        toast.error('Could not save changes');
      }
    } finally {
      setSaving(false);
      setUploadStatus('');
    }
  };

  // ─── Delete entry ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiClient.delete(`/entries/${id}`);
      toast.success('Your entry was deleted');
      navigate('/dashboard');
    } catch {
      toast.error("Couldn't delete this entry");
      setDeleting(false);
    }
  };

  const handleCancelEdit = () => {
    setTitle(initialTitle);
    setBlocks(cloneBlocks(initialBlocks));
    setMood(initialMood);
    setEditing(false);
  };

  // ─── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-dvh flex flex-col overflow-hidden transition-colors duration-200" style={{ background: 'var(--bg-app)' }}>
        <main className="flex-1 min-h-0 w-full mx-auto flex flex-col px-3 py-4">
          <div className="space-y-4 h-full">
            <div className="h-8 rounded w-2/3 skeleton" />
            <div className="h-3 rounded w-1/3 skeleton" />
            <div className="space-y-3 mt-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className={`h-4 rounded skeleton ${i % 3 === 2 ? 'w-3/4' : 'w-full'}`} />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const currentMood = moodMap[mood];
  const createdAtDate = entry ? new Date(entry.entryDate || entry.createdAt) : new Date();

  return (
    <div className="h-dvh flex flex-col overflow-hidden transition-colors duration-200" style={{ background: 'var(--bg-app)' }}>
      <main className="flex-1 min-h-0 w-full mx-auto flex flex-col">
        <form onSubmit={(e) => { e.preventDefault(); if (editing) handleSave(); }} className="flex-1 min-h-0 flex flex-col">
        <article
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

          {/* Date header + actions */}
          <div
            className="px-3 pt-4 pb-3 flex-shrink-0 flex items-center gap-2 flex-wrap"
            style={{ borderBottom: '1px solid var(--border-color)' }}
          >
            <span className="text-[11px] sm:text-xs uppercase tracking-widest font-medium" style={{ color: topMuted }}>
              {formatDate(createdAtDate)} · {formatTime(createdAtDate)}
            </span>
            {!editing && currentMood && (
              <span
                className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full"
                style={{
                  background: `${currentMood.color}15`,
                  border: `1px solid ${currentMood.color}35`,
                  color: currentMood.color,
                }}
              >
                {currentMood.emoji} {currentMood.label}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1 flex-shrink-0">
              {editing ? (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-all cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="p-2 rounded-lg transition-all cursor-pointer"
                    style={{ color: 'var(--gold)' }}
                    title="Edit entry"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDelete(true)}
                    className="p-2 rounded-lg transition-all cursor-pointer"
                    style={{ color: 'var(--text-ghost)' }}
                    title="Delete entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Delete confirm */}
          {showDelete && !editing && (
            <div className="px-3 py-2 flex-shrink-0 flex items-center gap-2 flex-wrap" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Delete this entry?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                style={{ background: 'rgba(224,85,85,0.15)', color: '#e05555', border: '1px solid rgba(224,85,85,0.3)' }}
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                className="text-xs cursor-pointer"
                style={{ color: 'var(--text-ghost)' }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Upload progress — only shows while photos are saving */}
          {uploadStatus && (
            <p className="flex items-center gap-2 text-xs px-3 py-2 flex-shrink-0" style={{ color: 'var(--gold)', borderBottom: '1px solid var(--border-color)' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {uploadStatus}
            </p>
          )}

          {/* Body — title scrolls together with the text */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-6 scroll-pb-32 sm:scroll-pb-28" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="pt-4 pb-1">
              {editing ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="Entry title…"
                  className="w-full outline-none bg-transparent font-display text-2xl sm:text-3xl transition-colors"
                  style={{ color: topInk, fontWeight: 400 }}
                />
              ) : (
                <h1
                  className="font-display text-2xl sm:text-3xl leading-snug"
                  style={{ color: topInk, fontWeight: 400 }}
                >
                  {title || 'Untitled Entry'}
                </h1>
              )}
            </div>

            <div className="my-2" style={{ height: '1px', background: 'var(--border-color)' }} />

            {editing ? (
              <BlockEditor blocks={blocks} onChange={setBlocks} cryptoKey={cryptoKey} disabled={saving} hideToolbar={keyboardOpen} mood={mood} onMoodChange={setMood} />
            ) : (
              <EntryContent blocks={blocks} cryptoKey={cryptoKey} metas={mediaMetas} />
            )}
          </div>
        </article>
        </form>
      </main>
    </div>
  );
}
