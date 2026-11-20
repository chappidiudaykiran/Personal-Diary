import React, { useEffect, useState } from 'react';

/**
 * Branded launch screen: centered app logo for 5 seconds on every
 * app boot, then fades out and opens the diary.
 */
export default function AppSplash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 4600);
    const hideTimer = setTimeout(() => setVisible(false), 5000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 transition-opacity duration-500"
      style={{
        background: 'linear-gradient(160deg, #9b62c9 0%, #8E5BC0 55%, #6f3fa3 100%)',
        opacity: fading ? 0 : 1,
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
  );
}
