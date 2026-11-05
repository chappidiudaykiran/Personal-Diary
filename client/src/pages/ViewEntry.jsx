import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Save, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar.jsx';
import MoodPicker, { moodMap } from '../components/MoodPicker.jsx';
import BlockEditor from '../components/BlockEditor.jsx';
import EntryContent from '../components/InlineMedia.jsx';
import { uploadMediaFile, listMedia, deleteMedia } from '../api/mediaApi.js';
import apiClient from '../api/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { encrypt, decrypt } from '../crypto/cryptoUtils.js';
import { useKeyboardOpen } from '../hooks/useKeyboardOpen.js';
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
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  // Hide footer + toolbar while typing so text stays clearly visible
  const keyboardOpen = useKeyboardOpen();

  // ─── Load & decrypt entry (old attachments become inline blocks at the end) ──
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await apiClient.get(`/entries/${id}`);
        setEntry(data.entry);
        setMood(data.entry.mood || '');
        setInitialMood(data.entry.mood || '');

        const [decTitle, decContent] = await Promise.all([
          decrypt(cryptoKey, data.entry.encryptedTitle, data.entry.iv),
          decrypt(cryptoKey, data.entry.encryptedContent, data.entry.ivContent),
        ]);
        setTitle(decTitle);
        setInitialTitle(decTitle);

        let parsed = parseEntryContent(decContent);
        let mediaIds = [];
        try {
          const metas = await listMedia(id);
          mediaIds = metas.map((m) => m._id);
          const referenced = referencedMediaIds(parsed);
          const unreferenced = metas.filter((m) => !referenced.has(m._id));
          if (unreferenced.length > 0) {
            parsed = [
              ...parsed,
              ...unreferenced.map((m) => createMediaBlock({ mediaId: m._id })),
            ];
          }
        } catch (_) {
          // Attachments are optional — the entry itself still loads
        }

        const normalized = normalizeBlocks(parsed);
        setBlocks(normalized);
        setInitialBlocks(cloneBlocks(normalized));
        setSavedMediaIds(mediaIds);
      } catch (err) {
        toast.error('Failed to load entry');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    if (cryptoKey) {
      load();
    } else {
      setLoading(false);
    }
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
    };
  };

  // ─── Save edited entry ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title cannot be empty');
      return;
    }
    if (!hasBlockContent(blocks)) {
      toast.error('Entry cannot be empty — add some text or media');
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
          setUploadStatus(`Encrypting & uploading ${i + 1} of ${pending.length}: ${block.file.name}`);
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

      // 3. Delete saved media whose blocks were removed while editing
      const stillReferenced = referencedMediaIds(finalBlocks);
      const removedIds = savedMediaIds.filter((mediaId) => !stillReferenced.has(mediaId));
      if (removedIds.length > 0) {
        await Promise.allSettled(removedIds.map((mediaId) => deleteMedia(mediaId)));
      }

      setBlocks(finalBlocks);
      setInitialBlocks(cloneBlocks(finalBlocks));
      setInitialTitle(title);
      setInitialMood(mood);
      setSavedMediaIds([...stillReferenced]);
      setEditing(false);

      if (failedUploads > 0) {
        toast.error(`Entry updated, but ${failedUploads} attachment${failedUploads === 1 ? '' : 's'} failed to upload`);
      } else {
        toast.success('Entry updated ✨');
      }
    } catch {
      toast.error('Failed to update entry');
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
      toast.success('Entry deleted');
      navigate('/dashboard');
    } catch {
      toast.error('Failed to delete entry');
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
        <Navbar />
        <main className="flex-1 min-h-0 w-full max-w-3xl mx-auto px-3 sm:px-6 py-4">
          <div
            className="rounded-2xl p-6 space-y-4 shadow-sm h-full"
            style={{ background: 'var(--panel-gradient)', border: '1px solid var(--border-color)' }}
          >
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
  const wordCount = countBlockWords(blocks);
  const createdAtDate = entry ? new Date(entry.createdAt) : new Date();
  const canSave = Boolean(title.trim()) && hasBlockContent(blocks);

  return (
    <div className="h-dvh flex flex-col overflow-hidden transition-colors duration-200" style={{ background: 'var(--bg-app)' }}>
      <Navbar />

      <main className="flex-1 min-h-0 w-full max-w-3xl mx-auto px-3 sm:px-6 py-3 sm:py-6 flex flex-col">
        {/* Back */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm mb-3 flex-shrink-0 self-start transition-colors cursor-pointer"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gold)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to diary
        </button>

        <article
          className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden fade-up shadow-sm relative"
          style={{
            background: 'var(--panel-gradient)',
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Gold top accent */}
          <div
            className="h-px flex-shrink-0"
            style={{ background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }}
          />

          {/* Header */}
          <div
            className="px-4 sm:px-8 pt-4 pb-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-color)' }}
          >
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[11px] sm:text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--text-muted)' }}>
                {formatDate(createdAtDate)} · {formatTime(createdAtDate)}
              </span>
              {wordCount > 0 && !editing && (
                <span className="text-xs" style={{ color: 'var(--text-ghost)' }}>
                  · {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </span>
              )}
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
            </div>

            {editing ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="w-full outline-none bg-transparent font-display text-2xl sm:text-3xl"
                style={{
                  color: 'var(--text-primary)',
                  fontWeight: 400,
                  borderBottom: '1px solid var(--border-bright)',
                  paddingBottom: '4px',
                }}
              />
            ) : (
              <h1
                className="font-display text-2xl sm:text-3xl leading-snug"
                style={{ color: 'var(--text-primary)', fontWeight: 400 }}
              >
                {title || 'Untitled Entry'}
              </h1>
            )}
          </div>

          {/* Body — only this part scrolls, and only when content is long */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-4 scroll-pb-32 sm:scroll-pb-28" style={{ WebkitOverflowScrolling: 'touch' }}>
            {editing ? (
              <BlockEditor blocks={blocks} onChange={setBlocks} cryptoKey={cryptoKey} disabled={saving} hideToolbar={keyboardOpen} />
            ) : (
              <EntryContent blocks={blocks} cryptoKey={cryptoKey} />
            )}
          </div>

          {/* Floating save while typing — footer is hidden so text stays visible */}
          {editing && keyboardOpen && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !canSave}
              className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold shadow-lg disabled:opacity-40 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}

          {/* Footer — hidden while typing so it never covers what you write */}
          {!(editing && keyboardOpen) && (
          <div
            className="px-4 sm:px-8 py-3 flex-shrink-0 space-y-3"
            style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
          >
            {uploadStatus && (
              <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--gold)' }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {uploadStatus}
              </p>
            )}

            {editing && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 [&>div]:flex-nowrap [&>div]:w-max">
                <span className="text-[11px] uppercase tracking-widest font-medium flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  Mood
                </span>
                <MoodPicker value={mood} onChange={setMood} />
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              {/* Delete */}
              <div className="min-w-0">
                {showDelete ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>Delete this entry?</span>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      style={{ background: 'rgba(224,85,85,0.15)', color: '#e05555', border: '1px solid rgba(224,85,85,0.3)' }}
                    >
                      {deleting ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button
                      onClick={() => setShowDelete(false)}
                      className="text-xs cursor-pointer"
                      style={{ color: 'var(--text-ghost)' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDelete(true)}
                    className="flex items-center gap-1.5 text-sm transition-colors cursor-pointer"
                    style={{ color: 'var(--text-ghost)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#e05555'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-ghost)'; }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                )}
              </div>

              {/* Edit / Save / Cancel */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {editing ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-all cursor-pointer"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !canSave}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                      style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' }}
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer"
                    style={{
                      background: 'var(--gold-glow)',
                      border: '1px solid var(--border-bright)',
                      color: 'var(--gold)',
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
          )}
        </article>
      </main>
    </div>
  );
}
