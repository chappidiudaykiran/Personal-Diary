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
 * Renders one saved media item.
 * layout="block": full-width, text goes below it.
 * layout="inline": flows inside the sentence, text continues after it.
 * Bytes arrive as ciphertext and are decrypted into an in-memory Blob URL.
 */
export function InlineMedia({ cryptoKey, mediaId, layout = 'block' }) {
  const inline = layout === 'inline';
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
    if (inline) {
      return (
        <span
          className="inline-flex items-center rounded-lg px-2 py-1 text-[11px] align-middle mx-1"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: '#e05555' }}
        >
          {error}
        </span>
      );
    }
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
    if (inline) {
      return (
        <span
          className="inline-flex items-center justify-center rounded-lg align-middle mx-1 h-24 w-36"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
        >
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-ghost)' }} />
        </span>
      );
    }
    return (
      <div
        className="rounded-xl h-44 flex items-center justify-center my-3"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
      >
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-ghost)' }} />
      </div>
    );
  }

  if (inline) {
    if (media.kind === 'image') {
      return (
        <img
          src={media.url}
          alt={media.name}
          title={media.name}
          className="inline-block h-28 sm:h-36 w-auto max-w-[75%] object-cover rounded-lg align-middle mx-1 my-1"
          style={{ border: '1px solid var(--border-color)' }}
          loading="lazy"
        />
      );
    }
    if (media.kind === 'video') {
      return (
        <video
          src={media.url}
          controls
          playsInline
          preload="metadata"
          title={media.name}
          className="inline-block w-60 max-w-[85%] rounded-lg align-middle mx-1 my-1"
          style={{ background: '#000', border: '1px solid var(--border-color)' }}
        />
      );
    }
    if (media.kind === 'audio') {
      return (
        <span
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1 align-middle mx-1"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
          title={media.name}
        >
          <FileAudio className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--gold)' }} />
          <audio controls src={media.url} className="h-8 w-48 max-w-[60vw]" />
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        title={media.name}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] align-middle mx-1 cursor-pointer disabled:opacity-50"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', color: 'var(--gold)' }}
      >
        {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        <span className="max-w-[140px] truncate">{media.name}</span>
        <Download className="w-3 h-3" />
      </button>
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

/**
 * Read-only rendering of an entry's blocks.
 * "inline" media flows inside the current paragraph (text continues after
 * it on the same line); "block" media breaks the paragraph and sits
 * full-width with the text below it.
 */
export default function EntryContent({ blocks, cryptoKey }) {
  const nodes = [];
  let flow = [];
  let flowKey = 0;

  const flushFlow = () => {
    if (flow.length === 0) return;
    nodes.push(
      <div
        key={`flow-${flowKey++}`}
        className="font-sans text-sm sm:text-base leading-[1.95] whitespace-pre-wrap my-2"
        style={{ color: 'var(--text-body)' }}
      >
        {flow}
      </div>
    );
    flow = [];
  };

  for (const block of blocks || []) {
    if (block.type === 'text') {
      if (block.text?.trim()) {
        flow.push(<span key={block.key}>{block.text}</span>);
      }
    } else if (block.type === 'media' && block.mediaId) {
      if (block.layout === 'inline') {
        flow.push(
          <InlineMedia key={block.key} cryptoKey={cryptoKey} mediaId={block.mediaId} layout="inline" />
        );
      } else {
        flushFlow();
        nodes.push(
          <InlineMedia key={block.key} cryptoKey={cryptoKey} mediaId={block.mediaId} layout="block" />
        );
      }
    }
  }
  flushFlow();

  return <div>{nodes}</div>;
}
