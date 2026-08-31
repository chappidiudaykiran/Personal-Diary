import React, { useEffect, useState } from 'react';
import { Plus, BookOpen, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar.jsx';
import EntryCard from '../components/EntryCard.jsx';
import apiClient from '../api/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { decrypt } from '../crypto/cryptoUtils.js';

export default function Dashboard() {
  const { cryptoKey } = useAuth();
  const [entries, setEntries] = useState([]);
  const [decryptedTitles, setDecryptedTitles] = useState({}); // { id: plaintext }
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');

  // ─── Fetch entries ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const { data } = await apiClient.get('/entries');
        setEntries(data.entries);

        // Decrypt all titles in parallel (titles are small, fast to decrypt)
        const titleMap = {};
        await Promise.all(
          data.entries.map(async (entry) => {
            try {
              titleMap[entry._id] = await decrypt(cryptoKey, entry.encryptedTitle, entry.iv);
            } catch {
              titleMap[entry._id] = '(Unable to decrypt)';
            }
          })
        );
        setDecryptedTitles(titleMap);
      } catch (err) {
        toast.error('Failed to load entries');
      } finally {
        setLoading(false);
      }
    };

    if (cryptoKey) fetchEntries();
  }, [cryptoKey]);

  // ─── Filter entries ────────────────────────────────────────────────────────
  const filtered = entries.filter((entry) => {
    const titleMatch = !search ||
      (decryptedTitles[entry._id] || '').toLowerCase().includes(search.toLowerCase());
    const moodMatch = !filter || entry.mood === filter;
    return titleMatch && moodMatch;
  });

  const moods = ['happy', 'excited', 'grateful', 'neutral', 'anxious', 'sad', 'angry'];
  const moodEmoji = { happy: '😊', excited: '🤩', grateful: '🙏', neutral: '😐', anxious: '😰', sad: '😢', angry: '😠' };

  return (
    <div className="min-h-screen bg-amber-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-800">My Diary</h1>
            <p className="text-stone-400 text-sm mt-0.5">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'} — all encrypted 🔐
            </p>
          </div>
          <Link
            to="/entry/new"
            className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-md w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            New Entry
          </Link>
        </div>

        {/* Search + Mood Filter */}
        {entries.length > 0 && (
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
            <div className="relative w-full sm:w-auto flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search entries…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-sm"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap w-full sm:w-auto">
              <button
                onClick={() => setFilter('')}
                className={`px-3 py-1.5 flex-1 sm:flex-none rounded-full text-sm transition border ${!filter ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-stone-500 border-stone-200 hover:border-amber-300'}`}
              >
                All
              </button>
              {moods.map((m) => (
                <button
                  key={m}
                  onClick={() => setFilter(filter === m ? '' : m)}
                  className={`px-3 py-1.5 flex-1 sm:flex-none rounded-full text-sm transition border flex justify-center ${filter === m ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-stone-500 border-stone-200 hover:border-amber-300'}`}
                >
                  {moodEmoji[m]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse">
                <div className="h-5 bg-stone-100 rounded w-3/4 mb-3" />
                <div className="h-3 bg-stone-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && entries.length === 0 && (
          <div className="text-center py-20 fade-in">
            <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold text-stone-600 mb-2">Your diary is empty</h2>
            <p className="text-stone-400 mb-6 text-sm">Start writing your first encrypted entry</p>
            <Link
              to="/entry/new"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-md"
            >
              <Plus className="w-4 h-4" />
              Write First Entry
            </Link>
          </div>
        )}

        {/* No results */}
        {!loading && entries.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-stone-400">No entries match your search.</p>
            <button onClick={() => { setSearch(''); setFilter(''); }} className="text-amber-500 text-sm mt-2 hover:underline">
              Clear filters
            </button>
          </div>
        )}

        {/* Entry grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 fade-in">
            {filtered.map((entry) => (
              <EntryCard
                key={entry._id}
                entry={entry}
                decryptedTitle={decryptedTitles[entry._id]}
                isDecrypting={!decryptedTitles[entry._id]}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
