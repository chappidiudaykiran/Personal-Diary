import { useEffect, useState } from 'react';

/**
 * True while the mobile keyboard is open (visual viewport shrunk).
 * Used to hide footers/toolbars so the typed text stays clearly visible.
 */
export function useKeyboardOpen(threshold = 0.78) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    const check = () => {
      try {
        if (vv) {
          setOpen(vv.height < window.innerHeight * threshold);
        } else {
          // Fallback: focused element is a text field
          const el = document.activeElement;
          setOpen(Boolean(el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text'))));
        }
      } catch (_) {}
    };

    check();
    if (vv) {
      vv.addEventListener('resize', check);
    }
    window.addEventListener('resize', check);
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    return () => {
      if (vv) vv.removeEventListener('resize', check);
      window.removeEventListener('resize', check);
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
    };
  }, [threshold]);

  return open;
}
