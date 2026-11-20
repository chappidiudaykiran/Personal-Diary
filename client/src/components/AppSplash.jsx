import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Branded launch screen (~2.7s): logo pops into the center with a gold glow,
 * greets you by name, then fades and the diary opens.
 */
const TAGLINE_BODIES = [
  'mood off aa? raasi padesey 😤',
  'ee roju em jarigindo cheppu ☕',
  'tension ekkuvaindi? aksharalu tho tagginchu 📝',
  'navvu aapaku, diary lo daachu 😄',
  'kopam vachinda? pen pattuko 😡',
  'badha ga undha? oka page raayi 💬',
  'happy ga unna? double ga raayi 🎉',
  'bore koduthundha? kotha page open chey 😴',
  'em aalochisthunnav? ventane raayi 💡',
  'secret undha? ikkade cheppu 🤫',
  'evariki cheppakunda anni raayi 🤐',
  'roju ela gachindo oka line raayi ☀️',
  'ninna night em kalo gurtundha? 🌙',
  'repu plans enti? mundhe raayi 📋',
  'chinna vishayam ayina pedda ga raayi 📖',
  'gunde baram ga undha? digipettu 🫶',
  'edupu vachindha? aksharalu aagavu 😢',
  'navvuthu edusthu anni raayi 😂',
  'kotha idea vachindha? miss avvaku 💡',
  'exam ayipoyinda? full relax 😌',
  'tiffin em thinnaro kuda raayi 🍵',
  'amma thittindha? ikkade complaint chey 😅',
  'best friend tho godava? raasi pettu 🤝',
  'filter coffee aagindha? fresh ga raayi ☕',
  'bus miss ayindha? parvaledu, raayi 🚌',
  'rain vachindha? window pakkana raayi 🌧️',
  'power cut ayindha? candle light lo raayi 🕯️',
  'dabbul vishayam aina raayi, lekkalu marchipoku 💰',
  'shopping chesava? story ga raayi 🛍️',
  'movie chusava? review raayi 🎬',
  'pata paata gurthochindha? venakki raaku 🎶',
  'match odipoyara? next time gelustham 🏆',
  'diet start chesava? first day story raayi 🥗',
  'gym ki vellava? energy note chey 💪',
  'kotta vishayam nerchukunnava? raasi pettu 🧠',
  'surprise vachindha? shock ni save chey 🎁',
  'long drive ki vellava? road story cheppu 🚗',
  'pandaga vachindha? sandadi ni aapu 🎊',
  'ee page ninnu miss avuthundhi ✍️',
  'kastaalu anni kathalu ga maarali 🔄',
];

export default function AppSplash() {
  const { user } = useAuth();
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);
  // Stable random pick per launch — the name is filled in at render time so
  // it never gets stuck on the logged-out fallback.
  const [lineIdx] = useState(() => Math.floor(Math.random() * TAGLINE_BODIES.length));

  useEffect(() => {
    // React is alive now — drop the instant HTML boot frame so only the
    // animated splash remains (identical black + logo frame, no jump).
    document.getElementById('boot-splash')?.remove();
    const fadeTimer = setTimeout(() => setFading(true), 2200);
    const hideTimer = setTimeout(() => setVisible(false), 2700);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  const name = user?.username || '';
  const title = name ? `Hey ${name}` : 'My Diary';
  const subtitle = name ? `${name}, ${TAGLINE_BODIES[lineIdx]}` : 'Your private space for everyday moments';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500"
      style={{
        background: 'radial-gradient(circle at 50% 42%, #23233a 0%, #101018 55%, #000000 100%)',
        opacity: fading ? 0 : 1,
      }}
    >
      <style>{`
        @keyframes splash-settle {
          0% { transform: scale(1.06); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes splash-glow {
          0%, 100% { box-shadow: 0 0 24px rgba(219,168,74,0.45), 0 12px 48px rgba(0,0,0,0.5); }
          50% { box-shadow: 0 0 54px rgba(219,168,74,0.8), 0 12px 48px rgba(0,0,0,0.5); }
        }
        @keyframes splash-text {
          0% { transform: translateY(18px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes splash-ring {
          0% { transform: scale(0.7); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      <div className="flex flex-col items-center gap-5">
        <div className="relative flex items-center justify-center">
          {/* Expanding gold ring */}
          <span
            className="absolute w-40 h-40 rounded-full"
            style={{
              border: '2px solid rgba(219,168,74,0.7)',
              animation: 'splash-ring 1.6s ease-out 0.2s both',
            }}
          />
          <img
            src="/icon-192.png"
            alt="My Diary"
            className="w-36 h-36 rounded-full relative"
            style={{
              border: '3px solid rgba(219,168,74,0.9)',
              animation: 'splash-settle 0.45s ease-out both, splash-glow 2s ease-in-out 0.45s infinite',
            }}
          />
        </div>
        <div
          className="text-center"
          style={{ animation: 'splash-text 0.7s ease-out 0.5s both' }}
        >
          <h1 className="font-display text-3xl" style={{ fontWeight: 600, color: '#e9c46a' }}>
            {title}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(237,232,216,0.65)' }}>
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
