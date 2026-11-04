import React, { useEffect, useRef, useState } from 'react';
import { Download, FileAudio, FileText, Loader2 } from 'lucide-react';
import {
  getMediaMeta,
  decryptMediaMeta,
  fetchDecryptedMedia,
  downloadObjectUrl,
  formatFileSize,
} from '../api/mediaApi.js';

/**
 * Renders one saved media item inline (between paragraphs).
 * Bytes arrive as ciphertext and are decrypted into an in-memory Blob URL.
 */
export function InlineMedia({ cryptoKey, mediaId }) {
  const [media, setMedia] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const urlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setError('');
        setMedia(null);
        const meta = await getMediaMeta(mediaId);
        const withMeta = await decryptMediaMeta(cryptoKey, meta);
        if (cancelled) return;
        setMedia(withMeta);

        if (withMeta.kind === 'image' || withMeta.kind === 'video' || withMeta.kind === 'audio') {
          const full = await fetchDecryptedMedia(cryptoKey, withMeta);
          if (cancelled) {
            URL.revokeObjectURL(full.url);
            return;
          }
          urlRef.current = full.url;
          setMedia(full);
        }
      } catch {
        if (!cancelled) setError('Attachment unavailable');
      }
    };

    if (cryptoKey && mediaId) load();
    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, [cryptoKey, mediaId]);

  const handleDownload = async () => {
    if (!media) return;
    try {
      setDownloading(true);
      const full = media.url ? media : await fetchDecryptedMedia(cryptoKey, media);
      if (!media.url) {
        urlRef.current = full.url;
        setMedia(full);
      }
      downloadObjectUrl(full.url, full.name);
    } catch {
      setError('Could not decrypt this file');
    } finally {
      setDownloading(false);
    }
  };

  if (error) {
    return (
      <div
        className="rounded-xl px-4 py-6 text-center text-xs my-3"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: '#e05555' }}
      >
        {error}
      </div>
    );
  }

  if (!media || ((media.kind === 'image' || media.kind === 'video' || media.kind === 'audio') && !media.url)) {
    return (
      <div
        className="rounded-xl h-44 flex items-center justify-center my-3"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
      >
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-ghost)' }} />
      </div>
    );
  }

  if (media.kind === 'image') {
    return (
      <figure className="my-3">
        <img
          src={media.url}
          alt={media.name}
          className="w-full max-h-[65vh] object-contain rounded-xl"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
          loading="lazy"
        />
        <figcaption className="text-[11px] mt-1.5 truncate" style={{ color: 'var(--text-ghost)' }}>
          {media.name}
        </figcaption>
      </figure>
    );
  }

  if (media.kind === 'video') {
    return (
      <figure className="my-3">
        <video
          src={media.url}
          controls
          playsInline
          preload="metadata"
          className="w-full max-h-[65vh] rounded-xl"
          style={{ background: '#000', border: '1px solid var(--border-color)' }}
        />
        <figcaption className="text-[11px] mt-1.5 truncate" style={{ color: 'var(--text-ghost)' }}>
          {media.name}
        </figcaption>
      </figure>
    );
  }

  if (media.kind === 'audio') {
    return (
      <div
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 my-3"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
      >
        <FileAudio className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--gold)' }} />
        <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>{media.name}</span>
        <audio controls src={media.url} className="h-8 max-w-[200px] sm:max-w-xs" />
      </div>
    );
  }

  // Documents / other files: decrypted only on download
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 my-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
    >
      <FileText className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--gold)' }} />
      <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>
        {media.name} · {formatFileSize(Math.max(0, (media.size || 0) - 16))}
      </span>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
        style={{ background: 'var(--gold-glow)', border: '1px solid var(--border-bright)', color: 'var(--gold)' }}
      >
        {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        Download
      </button>
    </div>
  );
}

/** Read-only rendering of an entry's blocks: paragraphs with media in between. */
export default function EntryContent({ blocks, cryptoKey }) {
  return (
    <div>
      {(blocks || []).map((block) => {
        if (block.type === 'media') {
          return block.mediaId ? (
            <InlineMedia key={block.key} cryptoKey={cryptoKey} mediaId={block.mediaId} />
          ) : null;
        }
        if (!block.text?.trim()) return null;
        return (
          <div
            key={block.key}
            className="font-sans text-sm sm:text-base leading-[1.95] whitespace-pre-wrap my-2"
            style={{ color: 'var(--text-body)' }}
          >
            {block.text}
          </div>
        );
      })}
    </div>
  );
}
