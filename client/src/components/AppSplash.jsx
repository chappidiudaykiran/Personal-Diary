import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Branded launch screen (~2.7s): logo pops into the center with a gold glow,
 * greets you by name, then fades and the diary opens.
 */
const TAGLINE_BODIES = [
  'mood off aa? ventane rayi 😤',
  'ee roju em jarigindo rayi ☕',
  'tension ekkuvaindi? aksharalu tho rayi 📝',
  'navvu aapaku, diary lo rayi 😄',
  'kopam vachinda? pen tho rayi 😡',
  'badha ga undha? oka page rayi 💬',
  'happy ga unna? double ga rayi 🎉',
  'bore koduthundha? kotha page rayi 😴',
  'em aalochisthunnav? ventane rayi 💡',
  'secret undha? ikkade rayi 🤫',
  'evariki cheppakunda anni rayi 🤐',
  'roju ela gachindo oka line rayi ☀️',
  'ninna night kala gurtosthe rayi 🌙',
  'repu plans enti? mundhe rayi 📋',
  'chinna vishayam ayina pedda ga rayi 📖',
  'gunde baram anni rayi 🫶',
  'edupu vachina aagakunda rayi 😢',
  'navvuthu edusthu anni rayi 😂',
  'kotha idea vachindha? miss avvakunda rayi 💡',
  'exam ayipoyinda? relax ayyi rayi 😌',
  'tiffin em thinnavo kuda rayi 🍵',
  'amma thittindha? complaint ga rayi 😅',
  'best friend godava kuda rayi 🤝',
  'filter coffee taguthu rayi ☕',
  'bus miss ayindha? parvaledu, rayi 🚌',
  'rain vasthunte window pakkana rayi 🌧️',
  'power cut ayindha? phone light lo rayi 🔦',
  'dabbul vishayam kuda lekka ga rayi 💰',
  'shopping chesina story rayi 🛍️',
  'movie chusina review rayi 🎬',
  'pata paata gurthoste feel ayyi rayi 🎶',
  'match odipoyina next gelupu rayi 🏆',
  'diet first day story rayi 🥗',
  'gym energy note ga rayi 💪',
  'kotta vishayam nerchukunte rayi 🧠',
  'surprise vachina shock ni rayi 🎁',
  'long drive road story rayi 🚗',
  'pandaga sandadi ni rayi 🎊',
  'ee page ninnu miss avuthundhi, vachi rayi ✍️',
  'kastaalu anni kathalu ga rayi 🔄',
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
    const fadeTimer = setTimeout(() => setFading(true), 2500);
    const hideTimer = setTimeout(() => setVisible(false), 3000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  const name = user?.username || '';
  const title = name ? `Hey ${name}` : 'My Diary';
  const subtitle = name ? TAGLINE_BODIES[lineIdx] : 'Your private space for everyday moments';

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
          <p className="text-2xl mt-2 leading-snug" style={{ color: 'rgba(237,232,216,0.85)' }}>
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
