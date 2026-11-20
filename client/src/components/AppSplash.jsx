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
      `${name}, mood off aa? raasi padesey 😤`,
      `${name}, ee roju em jarigindo cheppu ☕`,
      `${name}, tension ekkuvaindi? aksharalu tho tagginchu 📝`,
      `${name}, navvu aapaku, diary lo daachu 😄`,
      `${name}, kopam vachinda? pen pattuko 😡`,
      `${name}, badha ga undha? oka page raayi 💬`,
      `${name}, happy ga unna? double ga raayi 🎉`,
      `${name}, bore koduthundha? kotha page open chey 😴`,
      `${name}, em aalochisthunnav? ventane raayi 💡`,
      `${name}, secret undha? ikkade cheppu 🤫`,
      `${name}, evariki cheppakunda anni raayi 🤐`,
      `${name}, roju ela gachindo oka line raayi ☀️`,
      `${name}, ninna night em kalo gurtundha? 🌙`,
      `${name}, repu plans enti? mundhe raayi 📋`,
      `${name}, chinna vishayam ayina pedda ga raayi 📖`,
      `${name}, gunde baram ga undha? digipettu 🫶`,
      `${name}, edupu vachindha? aksharalu aagavu 😢`,
      `${name}, navvuthu edusthu anni raayi 😂`,
      `${name}, kotha idea vachindha? miss avvaku 💡`,
      `${name}, exam ayipoyinda? full relax 😌`,
      `${name}, tiffin em thinnaro kuda raayi 🍵`,
      `${name}, amma thittindha? ikkade complaint chey 😅`,
      `${name}, best friend tho godava? raasi pettu 🤝`,
      `${name}, filter coffee aagindha? fresh ga raayi ☕`,
      `${name}, bus miss ayindha? parvaledu, raayi 🚌`,
      `${name}, rain vachindha? window pakkana raayi 🌧️`,
      `${name}, power cut ayindha? candle light lo raayi 🕯️`,
      `${name}, dabbul vishayam aina raayi, lekkalu marchipoku 💰`,
      `${name}, shopping chesava? story ga raayi 🛍️`,
      `${name}, movie chusava? review raayi 🎬`,
      `${name}, pata paata gurthochindha? venakki raaku 🎶`,
      `${name}, match odipoyara? next time gelustham 🏆`,
      `${name}, diet start chesava? first day story raayi 🥗`,
      `${name}, gym ki vellava? energy note chey 💪`,
      `${name}, kotta vishayam nerchukunnava? raasi pettu 🧠`,
      `${name}, surprise vachindha? shock ni save chey 🎁`,
      `${name}, long drive ki vellava? road story cheppu 🚗`,
      `${name}, pandaga vachindha? sandadi ni aapu 🎊`,
      `${name}, ee page ninnu miss avuthundhi ✍️`,
      `${name}, kastaalu anni kathalu ga maarali 🔄`,
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
