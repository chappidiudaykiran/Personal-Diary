import React, { useEffect, useRef, useState } from 'react';
import { Download, FileAudio, FileText, Loader2 } from 'lucide-react';
import {
  getMediaMeta,
  decryptMediaMeta,
  fetchDecryptedMedia,
  downloadObjectUrl,
  formatFileSize,
} from '../api/mediaApi.js';
import { clampAsideWidth, normalizeLayout } from '../utils/entryBlocks.js';

/**
 * Renders one saved media item.
 * layout="block": full-width, text goes below it.
 * layout="aside": media sits beside text on the right side (flex row, not inline).
 *   Parent controls width; `width` is % of row.
 * Bytes arrive as ciphertext and are decrypted into an in-memory Blob URL.
 */
export function InlineMedia({ cryptoKey, mediaId, layout = 'block', width = 38 }) {
  const normalized = normalizeLayout(layout);
  const isAside = normalized === 'aside';
  const w = clampAsideWidth(width);
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
    if (isAside) {
      return (
        <div
          className="rounded-xl px-3 py-4 text-center text-xs w-full"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: '#e05555' }}
        >
          {error}
        </div>
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
    if (isAside) {
      return (
        <div
          className="rounded-xl h-36 flex items-center justify-center w-full"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
        >
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-ghost)' }} />
        </div>
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

  // ── Aside: compact, fills parent width (parent flex controls %)
  if (isAside) {
    if (media.kind === 'image') {
      return (
        <figure className="m-0 w-full">
          <img
            src={media.url}
            alt={media.name}
            className="w-full object-contain rounded-xl"
            style={{ maxHeight: '42vh', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
            loading="lazy"
          />
          <figcaption className="text-[11px] mt-1 truncate" style={{ color: 'var(--text-ghost)' }}>
            {media.name}
          </figcaption>
        </figure>
      );
    }
    if (media.kind === 'video') {
      return (
        <figure className="m-0 w-full">
          <video
            src={media.url}
            controls
            playsInline
            preload="metadata"
            className="w-full rounded-xl"
            style={{ maxHeight: '42vh', background: '#000', border: '1px solid var(--border-color)' }}
          />
          <figcaption className="text-[11px] mt-1 truncate" style={{ color: 'var(--text-ghost)' }}>
            {media.name}
          </figcaption>
        </figure>
      );
    }
    if (media.kind === 'audio') {
      return (
        <div
          className="flex items-center gap-2 rounded-xl px-2 py-2 w-full"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
        >
          <FileAudio className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--gold)' }} />
          <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>{media.name}</span>
          <audio controls src={media.url} className="h-7 w-28" />
        </div>
      );
    }
    // doc / file
    return (
      <div
        className="flex items-center gap-2 rounded-xl px-2 py-2 w-full"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
      >
        <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--gold)' }} />
        <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>
          {media.name} · {formatFileSize(Math.max(0, (media.size || 0) - 16))}
        </span>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg cursor-pointer disabled:opacity-50 flex-shrink-0"
          style={{ background: 'var(--gold-glow)', border: '1px solid var(--border-bright)', color: 'var(--gold)' }}
        >
          {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
        </button>
      </div>
    );
  }

  // ── Block: full-width below text
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
 * "aside" media sits beside text on the right side (flex row) with adjustable width,
 * not inline inside the sentence. "block" media breaks the paragraph and sits
 * full-width with the text below it. Stacks vertically on mobile.
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

  // Walk blocks sequentially; aside media is rendered as a flex row
  // where the accumulated text sits on the left and media on the right.
  // Width of media column is controlled per-block via `width` %.
  for (let i = 0; i < (blocks || []).length; i++) {
    const block = blocks[i];
    if (block.type === 'text') {
      if (block.text?.trim()) {
        flow.push(<span key={block.key}>{block.text}</span>);
      }
    } else if (block.type === 'media' && block.mediaId) {
      const layout = normalizeLayout(block.layout);
      if (layout === 'aside') {
        const width = clampAsideWidth(block.width);
        // Pull next text block into same row if adjacent, so both before & after text sit beside media
        let extraFlow = [];
        if (i + 1 < blocks.length && blocks[i + 1].type === 'text' && blocks[i + 1].text?.trim()) {
          extraFlow = [<span key={blocks[i + 1].key}>{blocks[i + 1].text}</span>];
          i++;
        }
        const leftContent = [...flow, ...extraFlow];
        // If no text at all, still render media full-width constrained to aside width but left side empty hint
        nodes.push(
          <div
            key={`aside-${block.key}`}
            className="flex flex-col sm:flex-row gap-4 my-3 items-start"
          >
            <div
              className="flex-1 min-w-0 font-sans text-sm sm:text-base leading-[1.95] whitespace-pre-wrap"
              style={{ color: 'var(--text-body)' }}
            >
              {leftContent.length > 0 ? leftContent : <span style={{ color: 'var(--text-ghost)' }} className="text-xs italic">—</span>}
            </div>
            <div
              className="flex-shrink-0 w-full sm:w-auto self-stretch sm:self-start"
              style={{ width: `min(${width}%, 100%)`, maxWidth: isFinite(width) ? `${width}%` : '38%', minWidth: '140px' }}
            >
              <InlineMedia cryptoKey={cryptoKey} mediaId={block.mediaId} layout="aside" width={width} />
            </div>
          </div>
        );
        flow = [];
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
