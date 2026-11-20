import React, { useEffect, useState } from 'react';

/**
 * Branded launch screen (~3s): logo pops into the center with a gold glow,
 * title rises beneath it, then everything fades and the diary opens.
 */
export default function AppSplash() {
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1700);
    const hideTimer = setTimeout(() => setVisible(false), 2200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500"
      style={{
        background: 'radial-gradient(circle at 50% 42%, #23233a 0%, #14141f 55%, #0c0c17 100%)',
        opacity: fading ? 0 : 1,
      }}
    >
      <style>{`
        @keyframes splash-pop {
          0% { transform: scale(0.4) translateY(30px); opacity: 0; }
          60% { transform: scale(1.08) translateY(0); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
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
            src="/icon-512.png"
            alt="My Diary"
            className="w-36 h-36 rounded-full relative"
            style={{
              border: '3px solid rgba(219,168,74,0.9)',
              animation: 'splash-pop 0.9s cubic-bezier(0.22, 1, 0.36, 1) both, splash-glow 2s ease-in-out 0.9s infinite',
            }}
          />
        </div>
        <div
          className="text-center"
          style={{ animation: 'splash-text 0.7s ease-out 0.5s both' }}
        >
          <h1 className="font-display text-3xl" style={{ fontWeight: 600, color: '#e9c46a' }}>
            My Diary
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(237,232,216,0.65)' }}>
            Your private space for everyday moments
          </p>
        </div>
      </div>
    </div>
  );
}
