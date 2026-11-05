import { useEffect, useRef, useState } from 'react';

/**
 * True while the mobile keyboard is open (touch devices only).
 * Compares the visual viewport against the full-height baseline captured
 * at mount, so it works whether or not the layout viewport resizes.
 * Used to hide footers/toolbars so the typed text stays clearly visible.
 */
export function useKeyboardOpen(threshold = 0.82) {
  const [open, setOpen] = useState(false);
  const baseRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    // Desktop: keyboard never covers the screen, never hide UI
    let isTouch = false;
    try {
      isTouch = window.matchMedia?.('(pointer: coarse)').matches ?? 'ontouchstart' in window;
    } catch (_) {}
    if (!isTouch) return;

    baseRef.current = window.innerHeight || 0;
    const vv = window.visualViewport;

    const isField = (el) =>
      el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'file'));

    const checkViewport = () => {
      try {
        const h = vv ? vv.height : window.innerHeight;
        if (h > (baseRef.current || 0)) baseRef.current = h; // grew (rotation) -> new baseline
        setOpen(h < baseRef.current * threshold);
      } catch (_) {}
    };

    const onFocusIn = (e) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (isField(e.target)) setOpen(true);
    };
    const onFocusOut = () => {
      // Grace period so taps on the floating Save pill still land
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(checkViewport, 350);
    };

    checkViewport();
    if (vv) vv.addEventListener('resize', checkViewport);
    window.addEventListener('resize', checkViewport);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      if (vv) vv.removeEventListener('resize', checkViewport);
      window.removeEventListener('resize', checkViewport);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [threshold]);

  return open;
}
