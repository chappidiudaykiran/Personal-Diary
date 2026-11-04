import React, { useEffect, useRef, useState } from 'react';
import {
  ImagePlus,
  Type,
  X,
  ChevronUp,
  ChevronDown,
  FileText,
  FileAudio,
  FileVideo,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  MEDIA_ACCEPT,
  MAX_FILE_BYTES,
  MAX_FILES_PER_ENTRY,
  isSupportedFile,
  kindFromMime,
  formatFileSize,
} from '../api/mediaApi.js';
import { InlineMedia } from './InlineMedia.jsx';
import { createTextBlock, createMediaBlock, clampAsideWidth } from '../utils/entryBlocks.js';

function AutoTextarea({ blockKey, value, onChange, onCursor, placeholder, disabled, first }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, first ? 72 : 36)}px`;
  }, [value, first]);
  const trackCursor = (e) => onCursor(blockKey, e.target.selectionStart ?? value.length);
  return (
    <textarea
      ref={ref}
      data-block-key={blockKey}
      value={value}
      disabled={disabled}
      onChange={(e) => { onChange(e.target.value); trackCursor(e); }}
      onFocus={trackCursor}
      onSelect={trackCursor}
      onClick={trackCursor}
      onKeyUp={trackCursor}
      placeholder={placeholder}
      rows={1}
      className="w-full outline-none bg-transparent text-sm sm:text-base leading-[1.9] font-sans py-1"
      style={{ color: 'var(--text-body)', minHeight: first ? '4.5rem' : '2.25rem' }}
    />
  );
}

function AsideFilePreview({ file }) {
  const [url, setUrl] = useState(null);
  const kind = kindFromMime(file.type, file.name);
  useEffect(() => {
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
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
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2 w-full" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
      {kind === 'audio' ? <FileAudio className="w-4 h-4" style={{ color: 'var(--gold)' }} /> : <FileText className="w-4 h-4" style={{ color: 'var(--gold)' }} />}
      <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>{file.name}</span>
    </div>
  );
}

export default function BlockEditor({ blocks, onChange, cryptoKey, disabled = false }) {
  const fileInputRef = useRef(null);
  const activeRef = useRef({ key: null, cursor: 0 });
  const focusKeyRef = useRef(null);
  const [, setFocusTick] = useState(0);
  const [selectedKey, setSelectedKey] = useState(null);
  const mediaCount = blocks.filter((b) => b.type === 'media').length;

  useEffect(() => {
    if (!focusKeyRef.current) return;
    const el = document.querySelector(`textarea[data-block-key="${focusKeyRef.current}"]`);
    if (el) { el.focus(); el.setSelectionRange(0, 0); focusKeyRef.current = null; }
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
      if (!isSupportedFile(file)) toast.error(`"${file.name}" is not a supported file type`);
      else if (file.size > MAX_FILE_BYTES) toast.error(`"${file.name}" is too large (max ${formatFileSize(MAX_FILE_BYTES)})`);
      else accepted.push(file);
    }
    if (accepted.length === 0) return;
    const room = MAX_FILES_PER_ENTRY - mediaCount;
    if (room <= 0) { toast.error(`Maximum ${MAX_FILES_PER_ENTRY} files per entry`); return; }
    const toInsert = accepted.slice(0, room);
    if (toInsert.length < accepted.length) toast.error(`Only ${room} more file${room === 1 ? '' : 's'} can be added`);
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
  };

  const insertTextBlock = () => {
    let index = blocks.findIndex((b) => b.key === activeRef.current.key);
    if (index === -1) index = blocks.length - 1;
    const tb = createTextBlock(''); const next = [...blocks.slice(0, index + 1), tb, ...blocks.slice(index + 1)];
    onChange(next); focusBlock(tb.key);
  };

  const removeBlock = (index) => {
    const next = [...blocks]; next.splice(index, 1);
    for (let i = 0; i < next.length - 1; i++) if (next[i].type === 'text' && next[i + 1].type === 'text') { next[i] = { ...next[i], text: `${next[i].text}${next[i + 1].text}` }; next.splice(i + 1, 1); i--; }
    if (next.length === 0) next.push(createTextBlock(''));
    setSelectedKey(null); onChange(next);
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

  // Group media + immediate next text so typing continues on right side by default.
  // Next standalone text blocks render full-width below the image.
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
        <div className="flex items-start gap-3">
          {mediaBox}
          {hasNextText ? (
            <div className="flex-1 min-w-0">
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
      <div className="flex-1">{rendered}</div>

      <div className="sticky bottom-0 mt-3 flex items-center gap-2 rounded-xl px-2 py-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', boxShadow: '0 -4px 16px rgba(0,0,0,0.12)' }}>
        <button type="button" disabled={disabled} onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' }}><ImagePlus className="w-4 h-4" />Media</button>
        <button type="button" disabled={disabled} onClick={insertTextBlock} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}><Type className="w-4 h-4" />Text</button>
        <span className="hidden sm:flex items-center gap-1 text-[11px] ml-1" style={{ color: 'var(--text-ghost)' }}><Lock className="w-3 h-3" />Double-click image to resize</span>
        <span className="sm:hidden text-[11px] ml-1" style={{ color: 'var(--text-ghost)' }}>Double-tap to resize</span>
        <span className="text-[11px] ml-auto flex-shrink-0" style={{ color: 'var(--text-ghost)' }}>{mediaCount}/{MAX_FILES_PER_ENTRY}</span>
      </div>
      <input ref={fileInputRef} type="file" multiple accept={MEDIA_ACCEPT} className="hidden" onChange={(e) => { insertFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
