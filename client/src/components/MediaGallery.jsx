import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileAudio,
  Lock,
  Loader2,
  Play,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listMedia,
  decryptMediaMeta,
  fetchDecryptedMedia,
  deleteMedia,
  downloadObjectUrl,
  formatFileSize,
} from '../api/mediaApi.js';

/**
 * Shows an entry's attachments. Everything arrives as ciphertext:
 * metadata (name/type) is decrypted first, then image/video/audio
 * bytes are downloaded + decrypted into in-memory Blob URLs.
 * Documents are only decrypted when opened/downloaded.
 */
export default function MediaGallery({ entryId, cryptoKey, editable = false, refreshKey = 0, onCountChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(-1);
  const [deletingId, setDeletingId] = useState(null);
  const urlsRef = useRef(new Set());

  const trackUrl = useCallback((url) => {
    if (url) urlsRef.current.add(url);
    return url;
  }, []);

  const revokeUrl = useCallback((url) => {
    if (url && urlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      urlsRef.current.delete(url);
    }
  }, []);

  // Revoke every Blob URL when leaving the entry
  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  const load = useCallback(async () => {
    if (!entryId || !cryptoKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const metas = await listMedia(entryId);
      const withMeta = await Promise.all(metas.map((m) => decryptMediaMeta(cryptoKey, m)));
      setItems(withMeta);
      onCountChange?.(withMeta.length);

      // Eagerly decrypt visual/audio media so thumbnails & players work
      await Promise.all(
        withMeta
          .filter((m) => m.kind === 'image' || m.kind === 'video' || m.kind === 'audio')
          .map(async (m) => {
            try {
              const full = await fetchDecryptedMedia(cryptoKey, m);
              trackUrl(full.url);
              setItems((prev) => prev.map((it) => (it._id === m._id ? { ...it, url: full.url } : it)));
            } catch {
              setItems((prev) =>
                prev.map((it) => (it._id === m._id ? { ...it, error: 'Could not decrypt' } : it))
              );
            }
          })
      );
    } catch {
      toast.error('Failed to load attachments');
    } finally {
      setLoading(false);
    }
  }, [entryId, cryptoKey, trackUrl]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const ensureUrl = useCallback(
    async (item) => {
      if (item.url) return item;
      const full = await fetchDecryptedMedia(cryptoKey, item);
      trackUrl(full.url);
      const updated = { ...item, url: full.url };
      setItems((prev) => prev.map((it) => (it._id === item._id ? updated : it)));
      return updated;
    },
    [cryptoKey, trackUrl]
  );

  const handleDownload = async (item) => {
    try {
      const withUrl = await ensureUrl(item);
      downloadObjectUrl(withUrl.url, withUrl.name);
    } catch {
      toast.error('Failed to decrypt file');
    }
  };

  const handleDelete = async (item) => {
    setDeletingId(item._id);
    try {
      await deleteMedia(item._id);
      revokeUrl(item.url);
      setItems((prev) => {
        const next = prev.filter((it) => it._id !== item._id);
        onCountChange?.(next.length);
        return next;
      });
      setLightbox(-1);
      toast.success('Attachment deleted');
    } catch {
      toast.error('Failed to delete attachment');
    } finally {
      setDeletingId(null);
    }
  };

  const openLightbox = async (index) => {
    const item = items[index];
    if (item.kind === 'pdf' || item.kind === 'file') {
      await handleDownload(item);
      return;
    }
    try {
      await ensureUrl(item);
      setLightbox(index);
    } catch {
      toast.error('Failed to decrypt file');
    }
  };

  // Lightbox keyboard navigation
  useEffect(() => {
    if (lightbox < 0) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(-1);
      if (e.key === 'ArrowRight') setLightbox((i) => Math.min(i + 1, items.length - 1));
      if (e.key === 'ArrowLeft') setLightbox((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, items.length]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs py-2" style={{ color: 'var(--text-ghost)' }}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading attachments…
      </div>
    );
  }

  if (items.length === 0) return null;

  const current = lightbox >= 0 ? items[lightbox] : null;

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
        Attachments ({items.length})
        <span className="flex items-center gap-1 normal-case tracking-normal" style={{ color: 'var(--text-ghost)' }}>
          <Lock className="w-3 h-3" /> end-to-end encrypted
        </span>
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {items.map((item, i) => (
          <div
            key={item._id}
            className="relative group rounded-lg overflow-hidden aspect-square"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
          >
            <button
              type="button"
              onClick={() => openLightbox(i)}
              className="w-full h-full cursor-pointer block"
              title={item.name}
            >
              {item.kind === 'image' && item.url ? (
                <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
              ) : item.kind === 'video' && item.url ? (
                <>
                  <video src={item.url} className="w-full h-full object-cover" muted preload="metadata" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
                      <Play className="w-4 h-4 text-white fill-white" />
                    </span>
                  </span>
                </>
              ) : item.kind === 'audio' ? (
                <span className="w-full h-full flex flex-col items-center justify-center gap-1.5 px-2 text-center">
                  <FileAudio className="w-7 h-7" style={{ color: 'var(--gold)' }} />
                  <span className="text-[10px] leading-tight line-clamp-2 break-all" style={{ color: 'var(--text-muted)' }}>
                    {item.name}
                  </span>
                </span>
              ) : item.kind === 'image' || item.kind === 'video' ? (
                <span className="w-full h-full flex items-center justify-center">
                  {item.error ? (
                    <span className="text-[10px] px-2 text-center" style={{ color: '#e05555' }}>{item.error}</span>
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-ghost)' }} />
                  )}
                </span>
              ) : (
                <span className="w-full h-full flex flex-col items-center justify-center gap-1.5 px-2 text-center">
                  <FileText className="w-7 h-7" style={{ color: 'var(--gold)' }} />
                  <span className="text-[10px] leading-tight line-clamp-2 break-all" style={{ color: 'var(--text-muted)' }}>
                    {item.name}
                  </span>
                </span>
              )}
            </button>

            <span
              className="absolute bottom-0 inset-x-0 text-[10px] px-1.5 py-0.5 truncate pointer-events-none"
              style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
            >
              {item.name} · {formatFileSize(Math.max(0, item.size - 16))}
            </span>

            {editable && (
              <button
                type="button"
                disabled={deletingId === item._id}
                onClick={() => handleDelete(item)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-50"
                style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                aria-label={`Delete ${item.name}`}
              >
                {deletingId === item._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Audio players (inline, since thumbnails can't play audio) */}
      {items.some((it) => it.kind === 'audio') && (
        <div className="space-y-2 mt-3">
          {items
            .filter((it) => it.kind === 'audio')
            .map((item) => (
              <div
                key={item._id}
                className="flex items-center gap-3 rounded-xl px-3 py-2"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
              >
                <FileAudio className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--gold)' }} />
                <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>{item.name}</span>
                {item.url ? (
                  <audio controls src={item.url} className="h-8 max-w-[220px]" />
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-ghost)' }} />
                )}
              </div>
            ))}
        </div>
      )}

      {/* Lightbox */}
      {current && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 fade-in"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setLightbox(-1)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
            onClick={() => setLightbox(-1)}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {lightbox > 0 && (
            <button
              type="button"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer z-10"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }}
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {lightbox < items.length - 1 && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer z-10"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
              aria-label="Next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          <div className="max-w-4xl w-full max-h-[88vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {current.kind === 'image' && current.url && (
              <img src={current.url} alt={current.name} className="max-h-[76vh] w-auto object-contain rounded-lg" />
            )}
            {current.kind === 'video' && current.url && (
              <video src={current.url} controls autoPlay className="max-h-[76vh] w-full rounded-lg" />
            )}
            {current.kind === 'audio' && current.url && (
              <div className="flex flex-col items-center gap-4 py-10">
                <FileAudio className="w-16 h-16" style={{ color: 'var(--gold)' }} />
                <audio controls autoPlay src={current.url} className="w-80 max-w-full" />
              </div>
            )}
            {(current.kind === 'pdf' || current.kind === 'file') && (
              <div className="flex flex-col items-center gap-4 py-10">
                <FileText className="w-16 h-16" style={{ color: 'var(--gold)' }} />
                <span className="text-white/70 text-sm">Use Download below to save &amp; open this file.</span>
              </div>
            )}
            {!current.url && current.kind !== 'pdf' && current.kind !== 'file' && (
              current.error ? (
                <span className="text-sm" style={{ color: '#ff9a9a' }}>{current.error}</span>
              ) : (
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              )
            )}

            <div className="flex items-center gap-3 text-sm text-white/80">
              <span className="truncate max-w-xs">{current.name}</span>
              <button
                type="button"
                onClick={() => handleDownload(current)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              {editable && (
                <button
                  type="button"
                  disabled={deletingId === current._id}
                  onClick={() => handleDelete(current)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
                  style={{ background: 'rgba(224,85,85,0.2)', color: '#ff9a9a' }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
