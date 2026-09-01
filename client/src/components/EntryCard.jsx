import React from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { moodMap } from './MoodPicker.jsx';

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDay(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export default function EntryCard({ entry, decryptedTitle, isDecrypting }) {
  const mood = moodMap[entry.mood];
  const dateObj = new Date(entry.createdAt);
  const title = decryptedTitle || entry.title || (isDecrypting ? 'Loading…' : 'Untitled Entry');
  const preview = entry.content ? entry.content.split('\n')[0].slice(0, 100) : '';
  const entryId = entry._id || entry.id;

  return (
    <Link to={`/entry/${entryId}`} className="group block h-full">
      <article
        className="relative h-full rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md"
        style={{
          background: 'var(--card-gradient)',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Gold top-line on hover */}
        <div
          className="absolute inset-x-0 top-0 h-px transition-opacity duration-300 opacity-0 group-hover:opacity-100"
          style={{ background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }}
        />

        <div className="p-5 sm:p-6 flex flex-col h-full gap-4">
          {/* Date + mood row */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-2xl font-display font-light leading-none"
                style={{ color: 'var(--gold)' }}
              >
                {String(dateObj.getDate()).padStart(2, '0')}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: 'var(--gold)', opacity: 0.9 }}>
                  {formatDay(dateObj)}
                </span>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
            {mood && (
              <span className="text-xl" title={mood.label}>{mood.emoji}</span>
            )}
          </div>

          {/* Title */}
          <div className="flex-1">
            {isDecrypting ? (
              <div className="h-5 rounded skeleton w-3/4 mb-2" />
            ) : (
              <h3
                className="font-display text-base sm:text-lg leading-snug mb-2 transition-colors duration-150 line-clamp-2"
                style={{ color: 'var(--text-primary)', fontWeight: 400 }}
              >
                {title}
              </h3>
            )}
            {preview && (
              <p
                className="text-xs sm:text-sm leading-relaxed line-clamp-2"
                style={{ color: 'var(--text-muted)' }}
              >
                {preview}
              </p>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center gap-3 text-[11px] pt-3"
            style={{ borderTop: '1px solid var(--border-color)', color: 'var(--text-ghost)' }}
          >
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {entry.wordCount || 0} {entry.wordCount === 1 ? 'word' : 'words'}
            </span>
            <span>{formatDate(dateObj)}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}
