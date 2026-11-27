import React, { useEffect, useState } from 'react';
import { ChevronLeft, BookOpen, Plus, MoreVertical } from 'lucide-react';

/**
 * Notes-app style top bar: back · title · book (drawing) · + (attach) · menu.
 */
export default function EditorTopBar({
  title,
  onBack,
  onTitleClick,
  onPlus,
  onBook,
  menuItems = [],
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [menuOpen]);

  return (
    <div
      className="flex-shrink-0 flex items-center gap-1 px-1 relative z-30"
      style={{
        background: 'var(--bg-app)',
        borderBottom: '1px solid var(--border-color)',
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        minHeight: '56px',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        className="p-2.5 rounded-full cursor-pointer flex-shrink-0"
        style={{ color: 'var(--text-primary)' }}
        title="Back"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        type="button"
        onClick={onTitleClick}
        className="flex-1 min-w-0 text-left truncate font-display text-lg cursor-pointer"
        style={{ color: title ? 'var(--text-primary)' : 'var(--text-ghost)', fontWeight: 400 }}
        title="Go to title"
      >
        {title || 'Title'}
      </button>

      <button
        type="button"
        onClick={onBook}
        className="p-2.5 rounded-full cursor-pointer flex-shrink-0"
        style={{ color: 'var(--text-primary)' }}
        title="Draw / handwriting"
      >
        <BookOpen className="w-5 h-5" />
      </button>

      <button
        type="button"
        onClick={onPlus}
        className="p-2.5 rounded-full cursor-pointer flex-shrink-0"
        style={{ color: 'var(--text-primary)' }}
        title="Attach"
      >
        <Plus className="w-6 h-6" />
      </button>

      {menuItems.length > 0 && (
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((s) => !s)}
            className="p-2.5 rounded-full cursor-pointer"
            style={{ color: 'var(--text-primary)' }}
            title="More options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-2xl py-1.5"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}
              >
                {menuItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => { setMenuOpen(false); item.onClick?.(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 cursor-pointer text-left text-sm"
                    style={{ color: item.danger ? '#e05555' : 'var(--text-primary)' }}
                  >
                    {item.icon && <item.icon className="w-4 h-4 flex-shrink-0" />}
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
