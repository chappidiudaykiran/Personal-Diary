import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar.jsx';
import MoodPicker from '../components/MoodPicker.jsx';
import BlockEditor from '../components/BlockEditor.jsx';
import { uploadMediaFile } from '../api/mediaApi.js';
import apiClient from '../api/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { encrypt } from '../crypto/cryptoUtils.js';
import {
  createTextBlock,
  serializeBlocks,
  countBlockWords,
  blocksToPlainText,
  hasBlockContent,
  normalizeBlocks,
} from '../utils/entryBlocks.js';

export default function NewEntry() {
  const { cryptoKey, user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState(() => normalizeBlocks([createTextBlock('')]));
  const [mood, setMood] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // New Entry always starts blank — no draft is restored or auto-saved.
  // Purge any draft left over from the old behaviour so it never comes back.
  useEffect(() => {
    try {
      const userId = user?.id || user?._id || 'guest';
      localStorage.removeItem(`diary_draft_${userId}_new_entry`);
    } catch (_) {}
  }, [user]);

  const wordCount = countBlockWords(blocks);
  const charCount = blocksToPlainText(blocks).length;
  const canSave = Boolean(title.trim()) && hasBlockContent(blocks);

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
    };
  };

  const handleSave = async (e) => {
    e.preventDefault();
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
      if (!entryId) throw new Error('Entry was not created');

      // 2. Encrypt + upload each inserted file, then point the blocks at the real ids
      const pending = blocks.filter((b) => b.type === 'media' && b.file);
      let failedUploads = 0;
      let finalBlocks = blocks;

      if (pending.length > 0) {
        finalBlocks = [...blocks];
        for (let i = 0; i < pending.length; i++) {
          const block = pending[i];
          try {
            setUploadStatus(`Encrypting & uploading ${i + 1} of ${pending.length}: ${block.file.name}`);
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
        toast.error(`Entry saved, but ${failedUploads} attachment${failedUploads === 1 ? '' : 's'} failed to upload`);
      } else {
        toast.success('Entry saved ✨');
      }
      navigate(`/entry/${entryId}`);
    } catch (err) {
      toast.error('Failed to save entry. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
      setUploadStatus('');
    }
  };

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="h-dvh flex flex-col overflow-hidden transition-colors duration-200" style={{ background: 'var(--bg-app)' }}>
      <Navbar />

      <main className="flex-1 min-h-0 w-full max-w-3xl mx-auto px-3 sm:px-6 py-3 sm:py-6 flex flex-col">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm mb-3 flex-shrink-0 self-start transition-colors cursor-pointer"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gold)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to diary
        </button>

        <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col">
          <div
            className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden fade-up shadow-sm"
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

            {/* Date header */}
            <div
              className="px-4 sm:px-8 pt-4 pb-3 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border-color)' }}
            >
              <p className="text-[11px] sm:text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--text-muted)' }}>
                {dateLabel}
              </p>
            </div>

            {/* Title input */}
            <div className="px-4 sm:px-8 pt-4 pb-1 flex-shrink-0">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Entry title…"
                maxLength={200}
                className="w-full outline-none bg-transparent font-display text-2xl sm:text-3xl transition-colors"
                style={{ color: 'var(--text-primary)', fontWeight: 400 }}
              />
            </div>

            <div className="mx-4 sm:mx-8 my-2 flex-shrink-0" style={{ height: '1px', background: 'var(--border-color)' }} />

            {/* Writing area — only this part scrolls, and only when content is long */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 pb-3">
              <BlockEditor blocks={blocks} onChange={setBlocks} cryptoKey={cryptoKey} disabled={saving} />
            </div>

            {/* Footer — always visible, no page scroll needed */}
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

              <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 [&>div]:flex-nowrap [&>div]:w-max">
                <span className="text-[11px] uppercase tracking-widest font-medium flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  Mood
                </span>
                <MoodPicker value={mood} onChange={setMood} />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-[11px] flex-shrink-0" style={{ color: 'var(--text-ghost)' }}>
                  <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                  <span>{charCount} chars</span>
                </div>
                <button
                  type="submit"
                  disabled={saving || !canSave}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-40 cursor-pointer shadow-sm flex-shrink-0"
                  style={{
                    background: saving || !canSave
                      ? 'rgba(196,145,58,0.3)'
                      : 'linear-gradient(135deg, #c4913a, #dba84a)',
                    color: saving || !canSave ? 'var(--text-muted)' : '#0c0c17',
                  }}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Entry
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
