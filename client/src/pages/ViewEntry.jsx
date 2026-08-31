import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Pencil, Trash2, Save, X, Hash, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar.jsx';
import MoodPicker from '../components/MoodPicker.jsx';
import apiClient from '../api/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { encrypt, decrypt } from '../crypto/cryptoUtils.js';
import { MOODS } from '../components/MoodPicker.jsx';

const moodMap = Object.fromEntries(MOODS.map((m) => [m.value, m]));

export default function ViewEntry() {
  const { id } = useParams();
  const { cryptoKey } = useAuth();
  const navigate = useNavigate();

  const [entry, setEntry] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ─── Load & decrypt entry ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await apiClient.get(`/entries/${id}`);
        setEntry(data.entry);
        setMood(data.entry.mood || '');

        // Decrypt in the browser — title uses iv, content uses ivContent
        const [decTitle, decContent] = await Promise.all([
          decrypt(cryptoKey, data.entry.encryptedTitle, data.entry.iv),
          decrypt(cryptoKey, data.entry.encryptedContent, data.entry.ivContent),
        ]);
        setTitle(decTitle);
        setContent(decContent);
      } catch (err) {
        toast.error('Failed to load entry');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    if (cryptoKey) load();
  }, [id, cryptoKey]);

  // ─── Save edited entry ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content cannot be empty');
      return;
    }
    setSaving(true);
    try {
      // Re-encrypt with fresh IVs on every save
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
      setEditing(false);
      toast.success('Entry updated & encrypted 🔐');
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

  // ─── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl p-8 animate-pulse space-y-4">
            <div className="h-8 bg-stone-100 rounded w-2/3" />
            <div className="h-3 bg-stone-100 rounded w-1/3" />
            <div className="space-y-2 mt-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className={`h-4 bg-stone-100 rounded ${i % 3 === 2 ? 'w-3/4' : 'w-full'}`} />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const currentMood = moodMap[mood];

  return (
    <div className="min-h-screen bg-amber-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Back */}
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-stone-400 hover:text-stone-600 text-sm mb-4 sm:mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to diary
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden fade-in">
          {/* Header */}
          <div className="p-4 sm:p-6 pb-3 sm:pb-4">
            {editing ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="w-full text-xl sm:text-2xl font-bold text-stone-800 border-b-2 border-amber-300 outline-none bg-transparent pb-1"
              />
            ) : (
              <h1 className="text-xl sm:text-2xl font-bold text-stone-800">{title || 'Untitled Entry'}</h1>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 sm:mt-2">
              <span className="text-[11px] sm:text-xs text-stone-400">
                {entry && format(new Date(entry.createdAt), 'EEEE, MMM d, yyyy · h:mm a')}
              </span>
              {entry?.wordCount > 0 && (
                <span className="text-[11px] sm:text-xs text-stone-400">{entry.wordCount} words</span>
              )}
              {currentMood && !editing && (
                <span className="text-xs sm:text-sm">{currentMood.emoji} {currentMood.label}</span>
              )}
              <span className="flex items-center gap-1 text-[10px] sm:text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Decrypted locally
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-stone-100 mx-4 sm:mx-6" />

          {/* Content */}
          <div className="p-4 sm:p-6">
            {editing ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                className="w-full text-stone-700 border border-stone-200 rounded-xl p-3 sm:p-4 outline-none focus:ring-2 focus:ring-amber-300 bg-stone-50 leading-relaxed text-sm sm:text-base"
              />
            ) : (
              <div className="text-stone-700 leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                {content}
              </div>
            )}
          </div>

          {/* Mood editor (edit mode) */}
          {editing && (
            <div className="px-4 sm:px-6 pb-4">
              <label className="flex items-center gap-1.5 text-sm font-medium text-stone-500 mb-2">
                <Hash className="w-3.5 h-3.5" />
                Mood
              </label>
              <MoodPicker value={mood} onChange={setMood} />
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-stone-100 p-4 sm:p-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-0">
            {/* Delete */}
            <div className="flex justify-center sm:justify-start">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm text-red-600 font-medium">Delete?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-xs sm:text-sm bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-xs sm:text-sm text-stone-400 hover:text-stone-600 px-2 py-1.5 transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center justify-center gap-1.5 text-stone-400 hover:text-red-500 text-sm transition py-2 sm:py-0"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>

            {/* Edit / Save / Cancel */}
            <div className="flex items-center justify-stretch sm:justify-end gap-2">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-stone-400 hover:text-stone-600 text-sm px-3 py-2 transition"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-xl transition shadow-md text-sm"
                  >
                    {saving ? (
                      <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 border border-amber-300 text-amber-600 hover:bg-amber-50 font-medium px-4 py-2 rounded-xl transition text-sm"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
