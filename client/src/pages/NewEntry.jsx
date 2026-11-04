import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar.jsx';
import MoodPicker from '../components/MoodPicker.jsx';
import MediaPicker from '../components/MediaPicker.jsx';
import { uploadMediaFile } from '../api/mediaApi.js';
import apiClient from '../api/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { encrypt } from '../crypto/cryptoUtils.js';

export default function NewEntry() {
  const { cryptoKey, user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
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

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please add a title for your entry');
      return;
    }
    if (!content.trim()) {
      toast.error('Your diary entry is empty');
      return;
    }

    setSaving(true);
    try {
      const { ciphertext: encryptedTitle, iv: titleIv } = await encrypt(cryptoKey, title.trim());
      const { ciphertext: encryptedContent, iv: contentIv } = await encrypt(cryptoKey, content.trim());

      const { data } = await apiClient.post('/entries', {
        encryptedTitle,
        encryptedContent,
        iv: titleIv,
        ivContent: contentIv,
        mood,
        wordCount,
      });

      // Encrypt + upload attachments one by one (each is encrypted in-browser)
      const entryId = data.entry?._id;
      let failedUploads = 0;
      if (entryId && pendingFiles.length > 0) {
        for (let i = 0; i < pendingFiles.length; i++) {
          try {
            setUploadStatus(`Encrypting & uploading ${i + 1} of ${pendingFiles.length}: ${pendingFiles[i].name}`);
            await uploadMediaFile(cryptoKey, entryId, pendingFiles[i]);
          } catch (uploadErr) {
            failedUploads++;
            console.error('Media upload failed:', uploadErr);
          }
        }
        setUploadStatus('');
      }

      if (failedUploads > 0) {
        toast.error(`Entry saved, but ${failedUploads} attachment${failedUploads === 1 ? '' : 's'} failed to upload`);
      } else {
        toast.success('Entry saved ✨');
      }
      navigate(entryId ? `/entry/${entryId}` : '/dashboard');
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
    <div className="min-h-screen transition-colors duration-200" style={{ background: 'var(--bg-app)' }}>
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm mb-8 transition-colors cursor-pointer"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gold)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to diary
        </button>

        <form onSubmit={handleSave}>
          <div
            className="rounded-2xl overflow-hidden fade-up shadow-sm"
            style={{
              background: 'var(--panel-gradient)',
              border: '1px solid var(--border-color)',
            }}
          >
            {/* Gold top accent */}
            <div
              className="h-px"
              style={{ background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }}
            />

            {/* Date header */}
            <div
              className="px-6 sm:px-8 pt-6 pb-4"
              style={{ borderBottom: '1px solid var(--border-color)' }}
            >
              <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--text-muted)' }}>
                {dateLabel}
              </p>
            </div>

            {/* Title input */}
            <div className="px-6 sm:px-8 pt-6 pb-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Entry title…"
                maxLength={200}
                className="w-full outline-none bg-transparent font-display text-2xl sm:text-3xl transition-colors"
                style={{
                  color: 'var(--text-primary)',
                  fontWeight: 400,
                }}
              />
            </div>

            {/* Divider */}
            <div
              className="mx-6 sm:mx-8 my-4"
              style={{ height: '1px', background: 'var(--border-color)' }}
            />

            {/* Content textarea */}
            <div className="px-6 sm:px-8">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={"Write freely. This is your safe space."}
                rows={18}
                className="w-full outline-none bg-transparent text-sm sm:text-base leading-[1.9] font-sans"
                style={{ color: 'var(--text-body)' }}
              />
            </div>

            {/* Footer */}
            <div
              className="px-6 sm:px-8 py-5 mt-4 space-y-5"
              style={{ borderTop: '1px solid var(--border-color)' }}
            >
              {/* Photos & media */}
              <div>
                <p className="text-xs uppercase tracking-widest font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
                  Photos &amp; Media
                </p>
                <MediaPicker files={pendingFiles} onChange={setPendingFiles} disabled={saving} />
                {uploadStatus && (
                  <p className="flex items-center gap-2 text-xs mt-3" style={{ color: 'var(--gold)' }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {uploadStatus}
                  </p>
                )}
              </div>

              {/* Mood */}
              <div>
                <p className="text-xs uppercase tracking-widest font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
                  How are you feeling?
                </p>
                <MoodPicker value={mood} onChange={setMood} />
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-ghost)' }}>
                  <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                  <span>{charCount} chars</span>
                </div>
                <button
                  type="submit"
                  disabled={saving || !title.trim() || !content.trim()}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-40 w-full sm:w-auto cursor-pointer shadow-sm"
                  style={{
                    background: saving || !title.trim() || !content.trim()
                      ? 'rgba(196,145,58,0.3)'
                      : 'linear-gradient(135deg, #c4913a, #dba84a)',
                    color: saving || !title.trim() || !content.trim() ? 'var(--text-muted)' : '#0c0c17',
                  }}
                >
                  {saving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
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
