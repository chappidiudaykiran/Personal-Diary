import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar.jsx';
import MoodPicker, { moodMap } from '../components/MoodPicker.jsx';
import apiClient from '../api/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { encrypt, decrypt } from '../crypto/cryptoUtils.js';

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
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [initialTitle, setInitialTitle] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [initialMood, setInitialMood] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // ─── Load & decrypt entry ──────────────────────────────────────────────────
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
        setContent(decContent);
        setInitialTitle(decTitle);
        setInitialContent(decContent);
      } catch (err) {
        toast.error('Failed to load entry');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    if (cryptoKey) load();
  }, [id, cryptoKey, navigate]);

  // ─── Save edited entry ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const { ciphertext: encryptedTitle, iv } = await encrypt(cryptoKey, title.trim());
      const { ciphertext: encryptedContent, iv: ivContent } = await encrypt(cryptoKey, content.trim());
      const wordCount = content.trim().split(/\s+/).length;

      const { data } = await apiClient.put(`/entries/${id}`, {
        encryptedTitle,
        encryptedContent,
        iv,
        ivContent,
        mood,
        wordCount,
      });

      setEntry(data.entry);
      setInitialTitle(title);
      setInitialContent(content);
      setInitialMood(mood);
      setEditing(false);
      toast.success('Entry updated ✨');
    } catch {
      toast.error('Failed to update entry');
    } finally {
      setSaving(false);
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
    setContent(initialContent);
    setMood(initialMood);
    setEditing(false);
  };

  // ─── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen transition-colors duration-200" style={{ background: 'var(--bg-app)' }}>
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div
            className="rounded-2xl p-8 space-y-4 shadow-sm"
            style={{
              background: 'var(--panel-gradient)',
              border: '1px solid var(--border-color)',
            }}
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
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const createdAtDate = entry ? new Date(entry.createdAt) : new Date();

  return (
    <div className="min-h-screen transition-colors duration-200" style={{ background: 'var(--bg-app)' }}>
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Back */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm mb-8 transition-colors cursor-pointer"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--gold)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to diary
        </button>

        <article
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

          {/* Header */}
          <div
            className="px-6 sm:px-8 pt-6 pb-5"
            style={{ borderBottom: '1px solid var(--border-color)' }}
          >
            {/* Date + badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--text-muted)' }}>
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

            {/* Title */}
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

          {/* Body */}
          <div className="px-6 sm:px-8 py-8">
            {editing ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                className="w-full outline-none rounded-xl px-4 py-3 text-sm sm:text-base leading-[1.9]"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-body)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-bright)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              />
            ) : (
              <div
                className="font-sans text-sm sm:text-base leading-[1.95] whitespace-pre-wrap"
                style={{ color: 'var(--text-body)' }}
              >
                {content}
              </div>
            )}
          </div>

          {/* Mood editor (edit mode) */}
          {editing && (
            <div
              className="px-6 sm:px-8 pb-5"
              style={{ borderTop: '1px solid var(--border-color)' }}
            >
              <p className="text-xs uppercase tracking-widest font-medium mt-5 mb-3" style={{ color: 'var(--text-muted)' }}>
                Mood
              </p>
              <MoodPicker value={mood} onChange={setMood} />
            </div>
          )}

          {/* Footer actions */}
          <div
            className="px-6 sm:px-8 py-5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4"
            style={{ borderTop: '1px solid var(--border-color)' }}
          >
            {/* Delete */}
            <div>
              {showDelete ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Delete this entry?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
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
                  Delete
                </button>
              )}
            </div>

            {/* Edit / Save / Cancel */}
            <div className="flex items-center gap-2">
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
                    disabled={saving || !title.trim() || !content.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                    style={{
                      background: 'linear-gradient(135deg, #c4913a, #dba84a)',
                      color: '#0c0c17',
                    }}
                  >
                    {saving ? (
                      <span className="w-3.5 h-3.5 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
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
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(196,145,58,0.16)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--gold-glow)';
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
