import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
  X,
  ChevronUp,
  ChevronDown,
  FileText,
  FileAudio,
  FileVideo,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  MAX_FILE_BYTES,
  MAX_FILES_PER_ENTRY,
  isSupportedFile,
  kindFromMime,
  formatFileSize,
} from '../api/mediaApi.js';
import { InlineMedia } from './InlineMedia.jsx';
import AttachSheet from './AttachSheet.jsx';
import DrawingPad from './DrawingPad.jsx';
import { createTextBlock, createMediaBlock, clampAsideWidth } from '../utils/entryBlocks.js';

function AutoTextarea({ blockKey, value, onChange, onCursor, placeholder, disabled, first }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Auto-grow without flicker: lock overflow so no inner scrollbar fights typing
    el.style.overflowY = 'hidden';
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, first ? 72 : 36)}px`;
  }, [value, first]);
  const trackCursor = (e) => onCursor(blockKey, e.target.selectionStart ?? value.length);
  // Keep caret visible with minimal, instant adjustment — never smooth/center,
  // which queues animations on every keystroke and makes text jump/disappear.
  const ensureVisible = (el) => {
    try {
      const scroller = el.closest('.overflow-y-auto');
      if (!scroller) {
        el.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        return;
      }
      const r = el.getBoundingClientRect();
      const sr = scroller.getBoundingClientRect();
      // Only nudge when the textarea bottom is actually hidden behind
      // the sticky bar / keyboard area. No animation so typing stays stable.
      if (r.bottom > sr.bottom - 24) {
        scroller.scrollTop += r.bottom - (sr.bottom - 24) + 8;
      }
    } catch (_) {}
  };
  const handleFocus = (e) => {
    trackCursor(e);
    const el = e.currentTarget;
    // Wait for mobile keyboard to settle, then nudge minimally (no centering)
    setTimeout(() => {
      try {
        if (document.activeElement === el) ensureVisible(el);
      } catch (_) {}
    }, 300);
  };
  return (
    <textarea
      ref={ref}
      data-block-key={blockKey}
      value={value}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value);
        trackCursor(e);
        // No auto-scroll while typing: the browser already keeps the caret
        // visible inside the textarea. Only the outer scroll container may
        // need a tiny nudge, and only if the caret left the viewport.
        // Intentionally no scrollIntoView here to avoid glitch/jump.
      }}
      onFocus={handleFocus}
      onSelect={trackCursor}
      onClick={trackCursor}
      onKeyUp={trackCursor}
      placeholder={placeholder}
      rows={1}
      className="w-full outline-none bg-transparent text-sm sm:text-base leading-[1.9] font-sans py-1"
      style={{
        color: 'var(--text-body)',
        minHeight: first ? '4.5rem' : '2.25rem',
        overflowY: 'hidden',
        overflowAnchor: 'none',
        scrollMarginBottom: '24px',
      }}
    />
  );
}

function AsideFilePreview({ file }) {
  const [url, setUrl] = useState(null);
  const kind = kindFromMime(file.type, file.name);
  useEffect(() => {
    if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      const objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setUrl(null);
  }, [file]);
  if (kind === 'image' && url) {
    return <img src={url} alt={file.name} className="w-full rounded-xl object-cover block" style={{ maxHeight: '65vh', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }} />;
  }
  if (kind === 'video' && url) {
    return <video src={url} controls playsInline className="w-full rounded-xl block" style={{ maxHeight: '65vh', background: '#000', border: '1px solid var(--border-color)' }} />;
  }
  if (kind === 'audio' && url) {
    return (
      <div className="flex flex-col gap-1 rounded-xl px-3 py-2 w-full" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-2">
          <FileAudio className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--gold)' }} />
          <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>{file.name}</span>
        </div>
        <audio controls src={url} preload="metadata" className="w-full h-8" />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2 w-full" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
      {kind === 'audio' ? <FileAudio className="w-4 h-4" style={{ color: 'var(--gold)' }} /> : <FileText className="w-4 h-4" style={{ color: 'var(--gold)' }} />}
      <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>{file.name}</span>
    </div>
  );
}

const BlockEditor = forwardRef(function BlockEditor({ blocks, onChange, cryptoKey, disabled = false }, ref) {
  const [showAttach, setShowAttach] = useState(false);
  const [showDraw, setShowDraw] = useState(false);
  const activeRef = useRef({ key: null, cursor: 0 });
  const focusKeyRef = useRef(null);
  const [, setFocusTick] = useState(0);
  const [selectedKey, setSelectedKey] = useState(null);
  const mediaCount = blocks.filter((b) => b.type === 'media').length;

  // Merge adjacent text blocks and collapse runs of empty text into one,
  // so repeated "Text" taps never stack "Continue writing..." placeholders.
  const tidyTextBlocks = (list) => {
    const next = [];
    for (const b of list) {
      const prev = next[next.length - 1];
      if (b.type === 'text' && prev?.type === 'text') {
        if (!b.text && !prev.text) continue; // drop duplicate empty
        next[next.length - 1] = { ...prev, text: `${prev.text || ''}${b.text || ''}` };
      } else {
        next.push(b);
      }
    }
    return next;
  };

  useEffect(() => {
    if (!focusKeyRef.current) return;
    const el = document.querySelector(`textarea[data-block-key="${focusKeyRef.current}"]`);
    if (el) {
      // Focus without jumping, place caret at end so continued typing is visible
      try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
      try {
        const end = el.value?.length ?? 0;
        el.setSelectionRange(end, end);
      } catch (_) {}
      focusKeyRef.current = null;
    }
  }, [blocks]);

  useEffect(() => {
    const onDocDown = (e) => { if (!e.target.closest('[data-media-block]')) setSelectedKey(null); };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('touchstart', onDocDown);
    return () => { document.removeEventListener('mousedown', onDocDown); document.removeEventListener('touchstart', onDocDown); };
  }, []);

  const handleCursor = (key, cursor) => { activeRef.current = { key, cursor }; };
  const focusBlock = (key) => { focusKeyRef.current = key; setFocusTick((n) => n + 1); };

  const insertFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;
    const accepted = [];
    for (const file of incoming) {
      if (!isSupportedFile(file)) toast.error(`"${file.name}" can't be added — please choose a photo, video, voice note or file`);
      else if (file.size > MAX_FILE_BYTES) toast.error(`"${file.name}" is too big — biggest size is ${formatFileSize(MAX_FILE_BYTES)}`);
      else accepted.push(file);
    }
    if (accepted.length === 0) return;
    const room = MAX_FILES_PER_ENTRY - mediaCount;
    if (room <= 0) { toast.error(`You can add up to ${MAX_FILES_PER_ENTRY} photos to one entry`); return; }
    const toInsert = accepted.slice(0, room);
    if (toInsert.length < accepted.length) toast.error(`You can add ${room} more`);
    let index = blocks.findIndex((b) => b.key === activeRef.current.key && b.type === 'text');
    let cursor = activeRef.current.cursor;
    if (index === -1) {
      index = blocks.map((b) => b.type).lastIndexOf('text');
      if (index === -1) { const tb = createTextBlock(''); index = blocks.length; cursor = 0; blocks = [...blocks, tb]; }
      else cursor = blocks[index].text.length;
    }
    const target = blocks[index];
    const before = createTextBlock(target.text.slice(0, cursor)); before.key = target.key;
    const after = createTextBlock(target.text.slice(cursor));
    const mediaBlocks = toInsert.map((file) => createMediaBlock({ file, width: 38 }));
    const next = [...blocks.slice(0, index), before, ...mediaBlocks, after, ...blocks.slice(index + 1)];
    onChange(next); focusBlock(after.key);
    if (mediaBlocks[0]) setSelectedKey(mediaBlocks[0].key);
    const firstKey = mediaBlocks.length > 0 ? mediaBlocks[0].key : null;
    if (firstKey) {
      const elId = 'media-box-' + firstKey;
      setTimeout(() => {
        try { document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
      }, 120);
    }
  };

  const insertTextBlock = () => {    const tidied = tidyTextBlocks(blocks);
    if (tidied.length !== blocks.length) onChange(tidied);
    const list = tidied;
    let index = list.findIndex((b) => b.key === activeRef.current.key);
    if (index === -1) index = list.length - 1;
    const current = list[index];
    // If the current or trailing text block is empty, just focus it
    // instead of stacking another "Continue writing..." box.
    if (current?.type === 'text' && !current.text) {
      focusBlock(current.key);
      return;
    }
    const last = list[list.length - 1];
    if (last?.type === 'text' && !last.text && index === list.length - 1) {
      focusBlock(last.key);
      return;
    }
    const tb = createTextBlock(''); const next = [...list.slice(0, index + 1), tb, ...list.slice(index + 1)];
    onChange(next); focusBlock(tb.key);
  };

  // Opened from the top-bar + (attach menu) and book (drawing) buttons.
  useImperativeHandle(ref, () => ({
    openAttachSheet: () => setShowAttach(true),
    openDrawing: () => setShowDraw(true),
  }), []);

  const removeBlock = (index) => {
    const next = [...blocks]; next.splice(index, 1);
    const tidied = tidyTextBlocks(next);
    if (tidied.length === 0) tidied.push(createTextBlock(''));
    setSelectedKey(null); onChange(tidied);
  };

  const setBlockWidth = (index, width) => {
    const next = [...blocks]; next[index] = { ...next[index], width: clampAsideWidth(width) }; onChange(next);
  };

  const moveBlock = (index, direction) => {
    const target = index + direction; if (target < 0 || target >= blocks.length) return;
    const next = [...blocks]; [next[index], next[target]] = [next[target], next[index]]; onChange(next);
  };

  const handleDragStart = (e, index, handle) => {
    if (disabled) return;
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX ?? e.touches?.[0]?.clientX;
    const startY = e.clientY ?? e.touches?.[0]?.clientY;
    if (startX == null) return;
    const startW = clampAsideWidth(blocks[index].width ?? 38);
    const container = document.getElementById(`media-box-${blocks[index].key}`);
    const parentW = container?.parentElement?.clientWidth || window.innerWidth * 0.85;
    const onMove = (ev) => {
      const x = ev.clientX ?? ev.touches?.[0]?.clientX;
      const y = ev.clientY ?? ev.touches?.[0]?.clientY;
      if (x == null) return;
      if (ev.cancelable) ev.preventDefault();
      let dx = x - startX;
      let dy = y - startY;
      let delta = 0;
      // Decide delta based on handle side
      if (handle.includes('r')) delta = dx;
      else if (handle.includes('l')) delta = -dx;
      else if (handle.includes('b')) delta = dy;
      else if (handle.includes('t')) delta = -dy;
      else delta = dx;
      // Corners use larger of dx/dy
      if (handle.length === 2) delta = Math.abs(dx) > Math.abs(dy) ? (handle.includes('r') ? dx : handle.includes('l') ? -dx : dx) : (handle.includes('b') ? dy : -dy);
      const newW = clampAsideWidth(startW + (delta / parentW) * 100);
      setBlockWidth(index, newW);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false }); window.addEventListener('touchend', onUp);
  };

  // Media on top, its immediate next text below full-width from the left edge.
  // No narrow side column, so text never gets stuck beside the image.
  const rendered = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'text') {
      rendered.push(
        <AutoTextarea
          key={block.key}
          blockKey={block.key}
          value={block.text}
          disabled={disabled}
          first={i === 0}
          placeholder={i === 0 ? 'Write freely. This is your safe space.' : 'Continue writing…'}
          onCursor={handleCursor}
          onChange={(text) => { const next = [...blocks]; next[i] = { ...block, text }; onChange(next); }}
        />
      );
      continue;
    }
    // Defensive: media with neither an attached file nor a saved id renders nothing
    if (!block.file && !block.mediaId) continue;
    const width = clampAsideWidth(block.width ?? 38);
    const isSelected = selectedKey === block.key;
    const nextBlock = i + 1 < blocks.length ? blocks[i + 1] : null;
    const hasNextText = nextBlock && nextBlock.type === 'text';
    const nextIndex = i + 1;

    const mediaBox = (
      <div
        id={`media-box-${block.key}`}
        onDoubleClick={(e) => { e.stopPropagation(); setSelectedKey(block.key); }}
        onClick={(e) => { e.stopPropagation(); setSelectedKey(block.key); }}
        className={`relative flex-shrink-0 self-start ${isSelected ? 'ring-2 ring-amber-400' : ''} rounded-xl`}
        style={{ width: `${width}%`, minWidth: '90px', maxWidth: '100%', touchAction: 'none' }}
      >
        {block.file ? <AsideFilePreview file={block.file} /> : block.mediaId ? <InlineMedia cryptoKey={cryptoKey} mediaId={block.mediaId} width={width} /> : null}
        {isSelected && !disabled && (
          <>
            {[
              { pos: 'top-1/2 -left-1.5 -translate-y-1/2', cursor: 'cursor-ew-resize', h: 'l' },
              { pos: 'top-1/2 -right-1.5 -translate-y-1/2', cursor: 'cursor-ew-resize', h: 'r' },
              { pos: 'left-1/2 -top-1.5 -translate-x-1/2', cursor: 'cursor-ns-resize', h: 't' },
              { pos: 'left-1/2 -bottom-1.5 -translate-x-1/2', cursor: 'cursor-ns-resize', h: 'b' },
              { pos: '-top-1.5 -left-1.5', cursor: 'cursor-nwse-resize', h: 'tl' },
              { pos: '-top-1.5 -right-1.5', cursor: 'cursor-nesw-resize', h: 'tr' },
              { pos: '-bottom-1.5 -left-1.5', cursor: 'cursor-nesw-resize', h: 'bl' },
              { pos: '-bottom-1.5 -right-1.5', cursor: 'cursor-nwse-resize', h: 'br' },
            ].map((hd) => (
              <div
                key={hd.h}
                onMouseDown={(e) => handleDragStart(e, i, hd.h)}
                onTouchStart={(e) => handleDragStart(e, i, hd.h)}
                className={`absolute ${hd.pos} w-3 h-3 bg-white border-2 rounded-full ${hd.cursor} touch-none select-none`}
                style={{ borderColor: 'var(--gold)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
              />
            ))}
          </>
        )}
      </div>
    );

    rendered.push(
      <div key={block.key} data-media-block className="relative my-2">
        <div className="flex flex-col gap-2">
          {mediaBox}
          {hasNextText ? (
            <div className="w-full">
              <AutoTextarea
                key={nextBlock.key}
                blockKey={nextBlock.key}
                value={nextBlock.text}
                disabled={disabled}
                first={false}
                placeholder="Continue writing…"
                onCursor={handleCursor}
                onChange={(text) => { const next = [...blocks]; next[nextIndex] = { ...nextBlock, text }; onChange(next); }}
              />
            </div>
          ) : null}
        </div>
        {isSelected && !disabled && (
          <div className="absolute top-1 right-1 flex items-center gap-1 z-10">
            <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}><ChevronUp className="w-4 h-4" /></button>
            <button type="button" onClick={() => moveBlock(i, 1)} disabled={i >= blocks.length - 1} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}><ChevronDown className="w-4 h-4" /></button>
            <button type="button" onClick={() => removeBlock(i)} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}><X className="w-4 h-4" /></button>
          </div>
        )}
      </div>
    );
    if (hasNextText) i++;
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1">
        {rendered}
        <div className="h-4" aria-hidden="true" />
      </div>

      <AttachSheet open={showAttach} onClose={() => setShowAttach(false)} onFiles={(files) => insertFiles(files)} />
      <DrawingPad open={showDraw} onClose={() => setShowDraw(false)} onSave={(file) => insertFiles([file])} />
    </div>
  );
});

export default BlockEditor;
