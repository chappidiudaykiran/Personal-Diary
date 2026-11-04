import React, { useEffect, useRef, useState } from 'react';
import { Download, FileAudio, FileText, Loader2 } from 'lucide-react';
import {
  getMediaMeta,
  decryptMediaMeta,
  fetchDecryptedMedia,
  downloadObjectUrl,
  formatFileSize,
} from '../api/mediaApi.js';
import { clampAsideWidth } from '../utils/entryBlocks.js';

/**
 * Renders one saved media item.
 * Media is wrapping by default: used inside a flex row where parent controls width (%).
 * Bytes arrive as ciphertext and are decrypted into an in-memory Blob URL.
 */
export function InlineMedia({ cryptoKey, mediaId, layout = 'aside', width = 38 }) {
  const w = clampAsideWidth(width);
  const [media, setMedia] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const urlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setError(''); setMedia(null);
        const meta = await getMediaMeta(mediaId);
        const withMeta = await decryptMediaMeta(cryptoKey, meta);
        if (cancelled) return; setMedia(withMeta);
        if (withMeta.kind === 'image' || withMeta.kind === 'video' || withMeta.kind === 'audio') {
          const full = await fetchDecryptedMedia(cryptoKey, withMeta);
          if (cancelled) { URL.revokeObjectURL(full.url); return; }
          urlRef.current = full.url; setMedia(full);
        }
      } catch { if (!cancelled) setError('Attachment unavailable'); }
    };
    if (cryptoKey && mediaId) load();
    return () => { cancelled = true; if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = null; };
  }, [cryptoKey, mediaId]);

  const handleDownload = async () => {
    if (!media) return;
    try {
      setDownloading(true);
      const full = media.url ? media : await fetchDecryptedMedia(cryptoKey, media);
      if (!media.url) { urlRef.current = full.url; setMedia(full); }
      downloadObjectUrl(full.url, full.name);
    } catch { setError('Could not decrypt this file'); } finally { setDownloading(false); }
  };

  if (error) {
    return <div className="rounded-xl px-3 py-4 text-center text-xs w-full" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: '#e05555' }}>{error}</div>;
  }
  if (!media || ((media.kind === 'image' || media.kind === 'video' || media.kind === 'audio') && !media.url)) {
    return <div className="rounded-xl h-36 flex items-center justify-center w-full" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-ghost)' }} /></div>;
  }

  if (media.kind === 'image') {
    return (
      <figure className="m-0 w-full">
        <img src={media.url} alt={media.name} className="w-full object-contain rounded-xl" style={{ maxHeight: '42vh', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }} loading="lazy" />
        <figcaption className="text-[11px] mt-1 truncate" style={{ color: 'var(--text-ghost)' }}>{media.name}</figcaption>
      </figure>
    );
  }
  if (media.kind === 'video') {
    return (
      <figure className="m-0 w-full">
        <video src={media.url} controls playsInline preload="metadata" className="w-full rounded-xl" style={{ maxHeight: '42vh', background: '#000', border: '1px solid var(--border-color)' }} />
        <figcaption className="text-[11px] mt-1 truncate" style={{ color: 'var(--text-ghost)' }}>{media.name}</figcaption>
      </figure>
    );
  }
  if (media.kind === 'audio') {
    return (
      <div className="flex items-center gap-2 rounded-xl px-2 py-2 w-full" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
        <FileAudio className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--gold)' }} />
        <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>{media.name}</span>
        <audio controls src={media.url} className="h-7 w-28" />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-xl px-2 py-2 w-full" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
      <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--gold)' }} />
      <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>{media.name} · {formatFileSize(Math.max(0, (media.size || 0) - 16))}</span>
      <button type="button" onClick={handleDownload} disabled={downloading} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg cursor-pointer disabled:opacity-50 flex-shrink-0" style={{ background: 'var(--gold-glow)', border: '1px solid var(--border-bright)', color: 'var(--gold)' }}>{downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}</button>
    </div>
  );
}

/**
 * Read-only rendering: media wraps on left, text continues on right side.
 * Next line (next standalone text block) starts below image (clear).
 */
export default function EntryContent({ blocks, cryptoKey }) {
  const nodes = [];
  let flow = [];
  let flowKey = 0;
  const flushFlow = () => {
    if (flow.length === 0) return;
    nodes.push(<div key={`flow-${flowKey++}`} className="font-sans text-sm sm:text-base leading-[1.95] whitespace-pre-wrap my-2" style={{ color: 'var(--text-body)' }}>{flow}</div>);
    flow = [];
  };

  for (let i = 0; i < (blocks || []).length; i++) {
    const block = blocks[i];
    if (block.type === 'text') {
      if (block.text?.trim()) flow.push(<span key={block.key}>{block.text}</span>);
    } else if (block.type === 'media' && block.mediaId) {
      const width = clampAsideWidth(block.width);
      // Text that was before media stays above (already in flow flushed as separate paragraph)
      // For wrapping, we want media left and immediate next text on right side.
      let rightText = [];
      if (i + 1 < (blocks || []).length && blocks[i + 1].type === 'text' && blocks[i + 1].text?.trim()) {
        rightText = [<span key={blocks[i + 1].key}>{blocks[i + 1].text}</span>];
        i++;
      }
      // If there was accumulated flow before media, flush it above first (not beside)
      if (flow.length > 0) { flushFlow(); }
      // Now render media wrap row: image left, right text beside it. Next flow after this will be below (clears)
      nodes.push(
        <div key={`wrap-${block.key}`} className="flex flex-col sm:flex-row gap-4 my-3 items-start">
          <div className="flex-shrink-0 w-full sm:w-auto" style={{ width: `min(${width}%, 100%)`, maxWidth: `${width}%`, minWidth: '140px' }}>
            <InlineMedia cryptoKey={cryptoKey} mediaId={block.mediaId} width={width} />
          </div>
          <div className="flex-1 min-w-0 font-sans text-sm sm:text-base leading-[1.95] whitespace-pre-wrap" style={{ color: 'var(--text-body)' }}>
            {rightText.length > 0 ? rightText : <span className="text-xs italic" style={{ color: 'var(--text-ghost)' }}></span>}
          </div>
        </div>
      );
      // following text blocks will flush below (cleared)
    }
  }
  flushFlow();
  return <div>{nodes}</div>;
}
