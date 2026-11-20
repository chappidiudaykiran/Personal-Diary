import React, { useEffect, useState } from 'react';

/**
 * Branded launch screen: app logo glides from the top into the center,
 * holds there for 4 seconds, then fades out and opens the diary.
 */
export default function AppSplash() {
  const [entered, setEntered] = useState(false);
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Kick off the glide-to-center on the next frame so the transition runs
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    // 1s glide + 4s hold in center, then fade out and open the app
    const fadeTimer = setTimeout(() => setFading(true), 5000);
    const hideTimer = setTimeout(() => setVisible(false), 5500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500"
      style={{
        background: 'linear-gradient(160deg, #9b62c9 0%, #8E5BC0 55%, #6f3fa3 100%)',
        opacity: fading ? 0 : 1,
      }}
    >
      <div
        className="flex flex-col items-center gap-5"
        style={{
          // Glide: starts above the center, small and transparent → settles centered
          transform: entered ? 'translateY(0) scale(1)' : 'translateY(-38vh) scale(0.55)',
          opacity: entered ? 1 : 0,
          transition: 'transform 1s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.7s ease-out',
        }}
      >
        <img
          src="/icon-512.png"
          alt="My Diary"
          className="w-40 h-40 rounded-full"
          style={{ boxShadow: '0 12px 48px rgba(0,0,0,0.35)', border: '4px solid rgba(255,255,255,0.85)' }}
        />
        <div className="text-center">
          <h1 className="font-display text-3xl text-white" style={{ fontWeight: 600 }}>
            My Diary
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Your private space for everyday moments
          </p>
        </div>
      </div>
    </div>
  );
}
