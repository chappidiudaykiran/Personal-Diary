import React from 'react';

const MOODS = [
  { value: 'happy',    emoji: '😊', label: 'Happy'    },
  { value: 'excited',  emoji: '🤩', label: 'Excited'  },
  { value: 'grateful', emoji: '🙏', label: 'Grateful' },
  { value: 'neutral',  emoji: '😐', label: 'Neutral'  },
  { value: 'anxious',  emoji: '😰', label: 'Anxious'  },
  { value: 'sad',      emoji: '😢', label: 'Sad'      },
  { value: 'angry',    emoji: '😠', label: 'Angry'    },
];

export { MOODS };

export default function MoodPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MOODS.map((mood) => (
        <button
          key={mood.value}
          type="button"
          onClick={() => onChange(value === mood.value ? '' : mood.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition border ${
            value === mood.value
              ? 'bg-amber-500 text-white border-amber-500 shadow-md'
              : 'bg-white text-stone-600 border-stone-200 hover:border-amber-300 hover:bg-amber-50'
          }`}
        >
          <span>{mood.emoji}</span>
          <span>{mood.label}</span>
        </button>
      ))}
    </div>
  );
}
