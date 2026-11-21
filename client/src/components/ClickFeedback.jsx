import { useEffect, useRef } from 'react';

/**
 * Global click / tap feedback.
 * - Shows a soft expanding ripple at every pointer-down point
 *   for a smooth, responsive feel.
 * - CSS `:active` press-scaling (in index.css) handles the
 *   button/card shrink effect. This component handles the ripple.
 */
export default function ClickFeedback() {
  const layerRef = useRef(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const onPointerDown = (e) => {
      // Ignore right-clicks / non-primary buttons
      if (e.button !== undefined && e.button !== 0) return;

      // Only animate taps on interactive elements — page-background taps
      // stay silent so the effect never feels "too much".
      const target = e.target instanceof Element ? e.target : null;
      const interactive = target?.closest?.(
        'button, a, [role="button"], input[type="submit"], input[type="button"], select, .pressable'
      );
      if (!interactive) return;

      const x = e.clientX;
      const y = e.clientY;
      if (x == null || y == null) return;

      const ripple = document.createElement('span');
      ripple.className = 'click-ripple';

      const size = 14;
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${x - size / 2}px`;
      ripple.style.top = `${y - size / 2}px`;

      layer.appendChild(ripple);

      // Clean up after animation ends (also guarded by timeout)
      const remove = () => ripple.remove();
      ripple.addEventListener('animationend', remove, { once: true });
      setTimeout(remove, 700);
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return <div ref={layerRef} className="click-ripple-layer" aria-hidden="true" />;
}
