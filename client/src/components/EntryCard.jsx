import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { FileText, Clock, Smile } from 'lucide-react';
import { MOODS } from './MoodPicker.jsx';

const moodMap = Object.fromEntries(MOODS.map((m) => [m.value, m.emoji]));

export default function EntryCard({ entry, decryptedTitle, isDecrypting }) {
  return (
    <Link to={`/entry/${entry._id}`} className="block group">
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all duration-200 p-5 h-full">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            {isDecrypting ? (
              <div className="h-5 bg-stone-100 rounded animate-pulse w-3/4" />
            ) : (
              <h3 className="font-semibold text-stone-800 truncate group-hover:text-amber-700 transition">
                {decryptedTitle || 'Untitled Entry'}
              </h3>
            )}
          </div>
          {entry.mood && (
            <span className="text-xl flex-shrink-0" title={entry.mood}>
              {moodMap[entry.mood] || ''}
            </span>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-stone-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(entry.createdAt), 'MMM d, yyyy')}
          </span>
          {entry.wordCount > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {entry.wordCount} words
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
