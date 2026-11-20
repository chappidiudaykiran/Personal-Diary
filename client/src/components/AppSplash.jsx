import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Branded launch screen (~2.7s): logo pops into the center with a gold glow,
 * greets you by name, then fades and the diary opens.
 */
export default function AppSplash() {
  const { user } = useAuth();
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);

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
  const [tagline] = useState(() => {
    const lines = [
      `${name}, ee page ninnu miss avuthundhi ✍️`,
      `${name}, chinna chinna vishayalu, pedda diary lo 🤫`,
      `${name}, roju kotha story raayi 📖`,
      `${name}, tension anni ikkade vadileyyi 😮‍💨`,
      `${name}, nee gnapakalu safe ga unnai 🔒`,
      `${name}, mood off aa? raasi padesey 😤`,
      `${name}, ee roju em jarigindo cheppu ☕`,
      `${name}, navvu kuda oka entry ye 😄`,
      `${name}, bad days kuda manchi stories 📝`,
      `${name}, yekkada aagavo akkade malli start chey 🚀`,
      `${name}, nee aalochana lu gold ra ✨`,
      `${name}, diary ante nee best friend ye 🤝`,
      `${name}, gusagusalu ikkade cheppu 🤫`,
      `${name}, kotha roju, kotha page, kotha story 🌅`,
      `${name}, tension teesuko, pen teesuko ✍️`,
      `${name}, navvutha raasi, edustha raasi 😂`,
      `${name}, secret lu safe, tension lu out 🔒`,
      `${name}, ee diary ki nuvve hero 🦸`,
      `${name}, chinna break teesuko, pedda ga raayi ☕`,
      `${name}, manchi roju ni marchipoku mundhu raayi 🌟`,
      `${name}, bhadha lu anni aksharalu ga marchu 💪`,
      `${name}, nee katha ni nuvve raayali 📖`,
      `${name}, oka page aipoindi, inko page ready? 📄`,
      `${name}, full clarity kosam full ga raayi 🧠`,
      `${name}, evariki cheppaleni vishayalu ikkade 🤐`,
      `${name}, happy news aithe double happy ga raayi 🎉`,
      `${name}, bore kodithe diary open chey 😴`,
      `${name}, ninna gurinchi, repu gurinchi, anni ikkade 🕰️`,
      `${name}, chadavadam kaadu, raayadam important ✍️`,
      `${name}, life lo anni twists ikkade untai 🌀`,
    ];
    if (!name) return 'Your private space for everyday moments';
    return lines[Math.floor(Math.random() * lines.length)];
  });
  const subtitle = tagline;

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
