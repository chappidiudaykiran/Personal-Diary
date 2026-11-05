import React, { useRef } from 'react';
import { X, Check, ImagePlus, Trash2 } from 'lucide-react';
import { useWallpaper } from '../context/WallpaperContext.jsx';

export default function WallpaperPicker({ isOpen, onClose }) {
  const { wallpaper, setWallpaper, customUrl, uploadCustom, deleteCustom, presets } = useWallpaper();
  const fileRef = useRef(null);

  if (!isOpen) return null;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await uploadCustom(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 fade-up max-h-[85dvh] overflow-y-auto"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg" style={{ color: 'var(--text-primary)' }}>
            Wallpaper
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-ghost)' }}>
          Sits behind your diary. Cards stay readable on top.
        </p>

        <div className="grid grid-cols-3 gap-2.5">
          {presets.map((p) => {
            const selected = wallpaper === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setWallpaper(p.id)}
                className="flex flex-col gap-1.5 cursor-pointer group"
              >
                <span
                  className="h-16 rounded-xl flex items-center justify-center transition-all"
                  style={{
                    background: p.css || 'var(--bg-elevated)',
                    border: selected ? '2px solid var(--gold)' : '1px solid var(--border-color)',
                    boxShadow: selected ? '0 0 0 2px var(--gold-glow)' : 'none',
                  }}
                >
                  {selected && <Check className="w-4 h-4" style={{ color: p.css ? '#fff' : 'var(--gold)' }} />}
                  {!p.css && (
                    <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-ghost)' }}>
                      None
                    </span>
                  )}
                </span>
                <span
                  className="text-[11px] text-center truncate"
                  style={{ color: selected ? 'var(--gold)' : 'var(--text-muted)', fontWeight: selected ? 600 : 400 }}
                >
                  {p.name}
                </span>
              </button>
            );
          })}

          {/* Custom photo tile */}
          <button
            type="button"
            onClick={() => (wallpaper === 'custom' && customUrl ? null : fileRef.current?.click())}
            className="flex flex-col gap-1.5 cursor-pointer"
          >
            <span
              className="h-16 rounded-xl flex items-center justify-center overflow-hidden transition-all relative"
              style={{
                background: customUrl ? `url("${customUrl}") center/cover` : 'var(--bg-elevated)',
                border: wallpaper === 'custom' ? '2px solid var(--gold)' : '1px dashed var(--border-bright)',
              }}
            >
              {!customUrl && <ImagePlus className="w-5 h-5" style={{ color: 'var(--gold)' }} />}
              {wallpaper === 'custom' && customUrl && (
                <span className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
                  <Check className="w-4 h-4 text-white" />
                </span>
              )}
            </span>
            <span
              className="text-[11px] text-center truncate"
              style={{ color: wallpaper === 'custom' ? 'var(--gold)' : 'var(--text-muted)', fontWeight: wallpaper === 'custom' ? 600 : 400 }}
            >
              {customUrl ? 'My photo' : 'Upload photo'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
          >
            <ImagePlus className="w-3.5 h-3.5" />
            {customUrl ? 'Change photo' : 'Upload photo'}
          </button>
          {customUrl && (
            <button
              type="button"
              onClick={deleteCustom}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer"
              style={{ background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)', color: '#e05555' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          )}
        </div>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}
