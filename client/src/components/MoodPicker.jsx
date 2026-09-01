import React from 'react';

export const MOODS = [
  { value: 'happy',    emoji: '😊', label: 'Happy',    color: '#d4a24a' },
  { value: 'excited',  emoji: '🤩', label: 'Excited',  color: '#c4913a' },
  { value: 'grateful', emoji: '🙏', label: 'Grateful', color: '#7fa35b' },
  { value: 'neutral',  emoji: '😐', label: 'Neutral',  color: '#7a7490' },
  { value: 'anxious',  emoji: '😰', label: 'Anxious',  color: '#9a7ab0' },
  { value: 'sad',      emoji: '😢', label: 'Sad',      color: '#5b87ad' },
  { value: 'angry',    emoji: '😠', label: 'Angry',    color: '#c05050' },
];

export const moodMap = Object.fromEntries(MOODS.map((m) => [m.value, m]));

export default function MoodPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MOODS.map((mood) => {
        const active = value === mood.value;
        return (
          <button
            key={mood.value}
            type="button"
            onClick={() => onChange(active ? '' : mood.value)}
            style={
              active
                ? { borderColor: mood.color, background: `${mood.color}25`, color: mood.color }
                : { background: 'var(--bg-elevated)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }
            }
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 border cursor-pointer hover:border-amber-400/50',
              active ? 'shadow-sm font-semibold' : '',
            ].join(' ')}
          >
            <span className="text-base leading-none">{mood.emoji}</span>
            <span>{mood.label}</span>
          </button>
        );
      })}
    </div>
  );
}
