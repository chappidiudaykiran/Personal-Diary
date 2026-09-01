import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BookOpen, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar.jsx';
import EntryCard from '../components/EntryCard.jsx';
import apiClient from '../api/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { decrypt } from '../crypto/cryptoUtils.js';
import { MOODS } from '../components/MoodPicker.jsx';

function formatGreeting(date) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatFullDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function Dashboard() {
  const { user, cryptoKey } = useAuth();
  const [entries, setEntries] = useState([]);
  const [decryptedTitles, setDecryptedTitles] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moodFilter, setMoodFilter] = useState('');

  // ─── Fetch entries ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const { data } = await apiClient.get('/entries');
        const list = data.entries || [];
        setEntries(list);

        const titleMap = {};
        await Promise.all(
          list.map(async (entry) => {
            try {
              titleMap[entry._id] = await decrypt(cryptoKey, entry.encryptedTitle, entry.iv);
            } catch {
              titleMap[entry._id] = 'Untitled Entry';
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
  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      const title = decryptedTitles[entry._id] || '';
      const titleMatch = !search || title.toLowerCase().includes(search.toLowerCase());
      const moodMatch = !moodFilter || entry.mood === moodFilter;
      return titleMatch && moodMatch;
    });
  }, [entries, decryptedTitles, search, moodFilter]);

  const now = new Date();
  const hasFilters = Boolean(search || moodFilter);

  return (
    <div className="min-h-screen transition-colors duration-200" style={{ background: 'var(--bg-app)' }}>
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        {/* Header */}
        <div
          className="mb-10 pb-8 fade-up"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>
                {formatFullDate(now)}
              </p>
              <h1
                className="font-display text-3xl sm:text-4xl"
                style={{ color: 'var(--text-primary)', fontWeight: 300 }}
              >
                {formatGreeting(now)},{' '}
                <em className="not-italic" style={{ color: 'var(--gold)' }}>
                  {user?.username || 'friend'}
                </em>
              </h1>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                {entries.length === 0
                  ? 'Your diary is empty. Start writing.'
                  : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
              </p>
            </div>

            <Link
              to="/entry/new"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 flex-shrink-0 self-start sm:self-auto shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #c4913a, #dba84a)',
                color: '#0c0c17',
              }}
            >
              <Plus className="w-4 h-4" />
              New Entry
            </Link>
          </div>
        </div>

        {/* Search + Mood filter */}
        {entries.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-8 fade-up" style={{ animationDelay: '0.05s' }}>
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-ghost)' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entries…"
                className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none transition-all duration-150"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-bright)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: 'var(--text-ghost)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Mood chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setMoodFilter('')}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer"
                style={
                  !moodFilter
                    ? { background: 'var(--gold-glow)', color: 'var(--gold)', border: '1px solid var(--border-bright)' }
                    : { background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }
                }
              >
                All
              </button>
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMoodFilter(moodFilter === m.value ? '' : m.value)}
                  className="px-2.5 py-1.5 rounded-full text-sm transition-all duration-150 cursor-pointer"
                  style={
                    moodFilter === m.value
                      ? { background: 'var(--gold-glow)', border: '1px solid var(--border-bright)' }
                      : { background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }
                  }
                  title={m.label}
                >
                  {m.emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div
            className="grid gap-4 fade-up"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            }}
          >
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-2xl p-5 flex flex-col justify-between"
                style={{
                  background: 'var(--card-gradient)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div className="flex justify-between items-center">
                  <div className="h-6 w-16 rounded skeleton" />
                  <div className="h-6 w-6 rounded-full skeleton" />
                </div>
                <div className="space-y-2 my-auto">
                  <div className="h-4 w-3/4 rounded skeleton" />
                  <div className="h-3 w-1/2 rounded skeleton" />
                </div>
                <div className="h-3 w-1/3 rounded skeleton pt-2" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 fade-up">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
              style={{ background: 'var(--gold-glow)', border: '1px solid var(--border-color)' }}
            >
              <BookOpen className="w-9 h-9" style={{ color: 'var(--gold)', opacity: 0.8 }} />
            </div>
            <h2 className="font-display text-xl mb-2" style={{ color: 'var(--text-primary)', fontWeight: 400 }}>
              Your diary awaits
            </h2>
            <p className="text-sm mb-8 text-center max-w-xs" style={{ color: 'var(--text-muted)' }}>
              Write your first entry.
            </p>
            <Link
              to="/entry/new"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm"
              style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' }}
            >
              <Plus className="w-4 h-4" />
              Write First Entry
            </Link>
          </div>
        )}

        {/* No results */}
        {!loading && entries.length > 0 && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>No entries match your search.</p>
            <button
              onClick={() => { setSearch(''); setMoodFilter(''); }}
              className="text-xs font-medium transition-colors cursor-pointer"
              style={{ color: 'var(--gold)' }}
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Active filter summary */}
        {!loading && hasFilters && filtered.length > 0 && (
          <div className="flex items-center gap-2 mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} found</span>
            <button
              onClick={() => { setSearch(''); setMoodFilter(''); }}
              className="flex items-center gap-1 transition-colors cursor-pointer"
              style={{ color: 'var(--gold)' }}
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          </div>
        )}

        {/* Entry grid */}
        {!loading && filtered.length > 0 && (
          <div
            className="grid gap-4 fade-up"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              animationDelay: '0.1s',
            }}
          >
            {filtered.map((entry, i) => (
              <div
                key={entry._id}
                className="fade-up"
                style={{ animationDelay: `${0.05 * Math.min(i, 8)}s` }}
              >
                <EntryCard
                  entry={entry}
                  decryptedTitle={decryptedTitles[entry._id]}
                  isDecrypting={!decryptedTitles[entry._id]}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
