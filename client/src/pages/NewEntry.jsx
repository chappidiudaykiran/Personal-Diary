import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Hash } from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar.jsx';
import MoodPicker from '../components/MoodPicker.jsx';
import apiClient from '../api/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { encrypt } from '../crypto/cryptoUtils.js';

export default function NewEntry() {
  const { cryptoKey } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [saving, setSaving] = useState(false);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

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
      // Encrypt title and content IN THE BROWSER using the derived AES key.
      // A unique random IV is generated for EACH field independently.
      // The plaintext NEVER leaves the browser.
      const { ciphertext: encryptedTitle, iv: titleIv } = await encrypt(cryptoKey, title.trim());
      const { ciphertext: encryptedContent, iv: contentIv } = await encrypt(cryptoKey, content.trim());

      await apiClient.post('/entries', {
        encryptedTitle,
        encryptedContent,
        iv: titleIv,
        ivContent: contentIv,
        mood,
        wordCount,
      });

      toast.success('Entry saved & encrypted 🔐');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Failed to save entry. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-stone-400 hover:text-stone-600 text-sm mb-4 sm:mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to diary
        </button>

        <form onSubmit={handleSave}>
          <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden fade-in">
            {/* Title */}
            <div className="p-4 sm:p-6 pb-0">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Entry title…"
                maxLength={200}
                className="w-full text-xl sm:text-2xl font-bold text-stone-800 placeholder-stone-300 border-none outline-none bg-transparent"
              />
              <div className="text-xs text-stone-300 mt-1 text-right">{title.length}/200</div>
            </div>

            {/* Divider */}
            <div className="border-t border-stone-100 mx-4 sm:mx-6 my-3 sm:my-4" />

            {/* Content */}
            <div className="px-4 sm:px-6">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your thoughts here… This is your safe space. Everything is encrypted and only you can read it."
                rows={16}
                className="w-full text-stone-700 placeholder-stone-300 border-none outline-none bg-transparent leading-relaxed text-sm sm:text-base"
              />
            </div>

            {/* Footer */}
            <div className="border-t border-stone-100 p-4 sm:p-6 space-y-5 sm:space-y-4">
              {/* Mood */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-stone-500 mb-2">
                  <Hash className="w-3.5 h-3.5" />
                  How are you feeling?
                </label>
                <MoodPicker value={mood} onChange={setMood} />
              </div>

              {/* Actions row */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 sm:gap-2">
                <span className="text-xs text-stone-400 text-center sm:text-left">
                  {wordCount} {wordCount === 1 ? 'word' : 'words'} · 🔐 Will be encrypted
                </span>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex justify-center items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-md w-full sm:w-auto"
                >
                  {saving ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'Encrypting & saving…' : 'Save Entry'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
