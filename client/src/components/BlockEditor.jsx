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
import { createTextBlock, createMediaBlock, clampAsideWidth, normalizeLayout } from '../utils/entryBlocks.js';

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
      onChange={(e) => {
        onChange(e.target.value);
        trackCursor(e);
      }}
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

function PendingMediaPreview({ file, layout = 'block' }) {
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
    return <img src={url} alt={file.name} className="w-full max-h-[50vh] object-contain rounded-xl" style={{ background: 'var(--bg-elevated)' }} />;
  }
  if (kind === 'video' && url) {
    return <video src={url} controls playsInline className="w-full max-h-[50vh] rounded-xl" style={{ background: '#000' }} />;
  }
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
    >
      {kind === 'audio' ? (
        <FileAudio className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--gold)' }} />
      ) : kind === 'video' ? (
        <FileVideo className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--gold)' }} />
      ) : (
        <FileText className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--gold)' }} />
      )}
      <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>
        {file.name} · {formatFileSize(file.size)}
      </span>
      <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-ghost)' }}>Not saved yet</span>
    </div>
  );
}

// Preview for file when in aside mode - fills its container (container width controls size)
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
    return <img src={url} alt={file.name} className="w-full rounded-lg object-cover" style={{ maxHeight: '220px', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }} />;
  }
  if (kind === 'video' && url) {
    return <video src={url} controls playsInline className="w-full rounded-lg" style={{ maxHeight: '220px', background: '#000', border: '1px solid var(--border-color)' }} />;
  }
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-2 w-full" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
      {kind === 'audio' ? <FileAudio className="w-4 h-4" style={{ color: 'var(--gold)' }} /> : <FileText className="w-4 h-4" style={{ color: 'var(--gold)' }} />}
      <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>{file.name}</span>
    </div>
  );
}

/**
 * Block editor: write text, tap "Media" and the file is inserted exactly
 * where the cursor is (splitting the paragraph), then keep writing below it.
 * Aside layout = media beside text on right side, width adjustable by dragging.
 */
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
    if (el) {
      el.focus();
      el.setSelectionRange(0, 0);
      focusKeyRef.current = null;
    }
  }, [blocks]);

  // Deselect when clicking outside media
  useEffect(() => {
    const onDocClick = (e) => {
      if (!e.target.closest('[data-media-block]')) setSelectedKey(null);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const handleCursor = (key, cursor) => {
    activeRef.current = { key, cursor };
  };

  const focusBlock = (key) => {
    focusKeyRef.current = key;
    setFocusTick((n) => n + 1);
  };

  const insertFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;
    const accepted = [];
    for (const file of incoming) {
      if (!isSupportedFile(file)) {
        toast.error(`"${file.name}" is not a supported file type`);
      } else if (file.size > MAX_FILE_BYTES) {
        toast.error(`"${file.name}" is too large (max ${formatFileSize(MAX_FILE_BYTES)})`);
      } else {
        accepted.push(file);
      }
    }
    if (accepted.length === 0) return;
    const room = MAX_FILES_PER_ENTRY - mediaCount;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_FILES_PER_ENTRY} files per entry`);
      return;
    }
    const toInsert = accepted.slice(0, room);
    if (toInsert.length < accepted.length) {
      toast.error(`Only ${room} more file${room === 1 ? '' : 's'} can be added`);
    }
    let index = blocks.findIndex((b) => b.key === activeRef.current.key && b.type === 'text');
    let cursor = activeRef.current.cursor;
    if (index === -1) {
      index = blocks.map((b) => b.type).lastIndexOf('text');
      if (index === -1) {
        const textBlock = createTextBlock('');
        index = blocks.length;
        cursor = 0;
        blocks = [...blocks, textBlock];
      } else {
        cursor = blocks[index].text.length;
      }
    }
    const target = blocks[index];
    const before = createTextBlock(target.text.slice(0, cursor));
    before.key = target.key;
    const after = createTextBlock(target.text.slice(cursor));
    const mediaBlocks = toInsert.map((file) => createMediaBlock({ file }));
    const next = [...blocks.slice(0, index), before, ...mediaBlocks, after, ...blocks.slice(index + 1)];
    onChange(next);
    focusBlock(after.key);
    if (mediaBlocks[0]) setSelectedKey(mediaBlocks[0].key);
  };

  const insertTextBlock = () => {
    let index = blocks.findIndex((b) => b.key === activeRef.current.key);
    if (index === -1) index = blocks.length - 1;
    const textBlock = createTextBlock('');
    const next = [...blocks.slice(0, index + 1), textBlock, ...blocks.slice(index + 1)];
    onChange(next);
    focusBlock(textBlock.key);
  };

  const removeBlock = (index) => {
    const next = [...blocks];
    next.splice(index, 1);
    for (let i = 0; i < next.length - 1; i++) {
      if (next[i].type === 'text' && next[i + 1].type === 'text') {
        next[i] = { ...next[i], text: `${next[i].text}${next[i + 1].text}` };
        next.splice(i + 1, 1);
        i--;
      }
    }
    if (next.length === 0) next.push(createTextBlock(''));
    setSelectedKey(null);
    onChange(next);
  };

  const setBlockLayout = (index, layout) => {
    const next = [...blocks];
    const normalized = normalizeLayout(layout);
    const current = next[index];
    next[index] = {
      ...current,
      layout: normalized,
      width: normalized === 'aside' ? clampAsideWidth(current.width ?? 38) : undefined,
    };
    onChange(next);
    if (normalized === 'aside') setSelectedKey(current.key);
  };

  const setBlockWidth = (index, width) => {
    const next = [...blocks];
    next[index] = { ...next[index], width: clampAsideWidth(width) };
    onChange(next);
  };

  const moveBlock = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const handleDragStart = (e, index) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX ?? e.touches?.[0]?.clientX;
    if (startX == null) return;
    const startW = clampAsideWidth(blocks[index].width ?? 38);
    const rowEl = document.getElementById(`media-aside-row-${blocks[index].key}`);
    const parentW = rowEl ? rowEl.clientWidth : window.innerWidth * 0.85;
    const onMove = (ev) => {
      const x = ev.clientX ?? ev.touches?.[0]?.clientX;
      if (x == null) return;
      // allow page scroll on touch but prevent default for handle drag
      if (ev.cancelable) ev.preventDefault();
      const dx = x - startX;
      const newW = clampAsideWidth(startW + (dx / parentW) * 100);
      setBlockWidth(index, newW);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1">
        {blocks.map((block, index) => {
          if (block.type === 'text') {
            return (
              <AutoTextarea
                key={block.key}
                blockKey={block.key}
                value={block.text}
                disabled={disabled}
                first={index === 0}
                placeholder={index === 0 ? 'Write freely. This is your safe space.' : 'Continue writing…'}
                onCursor={handleCursor}
                onChange={(text) => {
                  const next = [...blocks];
                  next[index] = { ...block, text };
                  onChange(next);
                }}
              />
            );
          }

          const layout = normalizeLayout(block.layout);
          const isAside = layout === 'aside';
          const width = clampAsideWidth(block.width ?? 38);
          const isSelected = selectedKey === block.key;

          // ── Aside: media beside text on right, draggable to resize ──
          if (isAside) {
            return (
              <div
                key={block.key}
                data-media-block
                className={`relative my-3 rounded-xl p-2 ${isSelected ? 'ring-2 ring-amber-400/60' : ''}`}
                style={{ border: '1px dashed var(--border-color)', background: 'var(--bg-elevated)' }}
                onClick={(e) => { e.stopPropagation(); setSelectedKey(block.key); }}
              >
                <div id={`media-aside-row-${block.key}`} className="flex flex-col sm:flex-row gap-3 items-stretch">
                  <div
                    className="flex-1 min-w-0 rounded-lg px-3 py-5 flex items-center justify-center text-xs text-center"
                    style={{ border: '1px dashed var(--border-color)', color: 'var(--text-ghost)', background: 'var(--bg-raised)' }}
                  >
                    Text on left — drag handle on image to resize
                  </div>
                  <div
                    className="relative flex-shrink-0 self-start group"
                    style={{ width: `${width}%`, minWidth: '110px', maxWidth: '62%' }}
                  >
                    {block.file ? (
                      <AsideFilePreview file={block.file} />
                    ) : block.mediaId ? (
                      <InlineMedia cryptoKey={cryptoKey} mediaId={block.mediaId} layout="aside" width={width} />
                    ) : null}
                    {/* Drag handle - visible when selected or on hover, large touch target */}
                    {!disabled && (
                      <>
                        {/* vertical bar handle on right edge */}
                        <div
                          onMouseDown={(e) => handleDragStart(e, index)}
                          onTouchStart={(e) => handleDragStart(e, index)}
                          className={`absolute top-1/2 -translate-y-1/2 -right-2 w-5 h-16 rounded-full flex items-center justify-center cursor-ew-resize touch-none select-none transition-opacity ${isSelected ? 'opacity-100' : 'opacity-60 sm:opacity-0 sm:group-hover:opacity-100'}`}
                          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
                          aria-label="Drag to resize"
                        >
                          <div className="w-1 h-8 rounded-full" style={{ background: 'rgba(255,255,255,0.9)' }} />
                        </div>
                        {/* corner handle bottom-right */}
                        <div
                          onMouseDown={(e) => handleDragStart(e, index)}
                          onTouchStart={(e) => handleDragStart(e, index)}
                          className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center cursor-nwse-resize touch-none select-none border-2 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-70 sm:opacity-0 sm:group-hover:opacity-100'}`}
                          style={{ background: '#fff', borderColor: 'var(--gold)', boxShadow: '0 1px 6px rgba(0,0,0,0.3)' }}
                        >
                          <div className="w-2 h-2 rounded-sm" style={{ background: 'var(--gold)' }} />
                        </div>
                        <div className="absolute -bottom-6 right-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>{width}%</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Layout toggle */}
                {!disabled && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-ghost)' }}>Layout</span>
                    <div className="flex rounded-full overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                      {[
                        { value: 'aside', label: 'Beside text (right side)' },
                        { value: 'block', label: 'Below text' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setBlockLayout(index, option.value); }}
                          className="px-2.5 py-1 text-[11px] font-medium cursor-pointer transition-colors"
                          style={layout === option.value ? { background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' } : { background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] ml-auto" style={{ color: 'var(--text-ghost)' }}>Select image then drag handle to resize</span>
                  </div>
                )}

                {!disabled && (
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }} aria-label="Move up"><ChevronUp className="w-4 h-4" /></button>
                    <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }} aria-label="Move down"><ChevronDown className="w-4 h-4" /></button>
                    <button type="button" onClick={() => removeBlock(index)} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }} aria-label="Remove attachment"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            );
          }

          // ── Block: full width below text ──
          return (
            <div key={block.key} data-media-block className="relative group my-2">
              {block.file ? <PendingMediaPreview file={block.file} layout="block" /> : block.mediaId ? <InlineMedia cryptoKey={cryptoKey} mediaId={block.mediaId} layout="block" /> : null}
              {!disabled && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-ghost)' }}>Layout</span>
                  <div className="flex rounded-full overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                    {[
                      { value: 'aside', label: 'Beside text (right side)' },
                      { value: 'block', label: 'Below text' },
                    ].map((option) => (
                      <button key={option.value} type="button" onClick={() => setBlockLayout(index, option.value)} className="px-2.5 py-1 text-[11px] font-medium cursor-pointer transition-colors" style={layout === option.value ? { background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' } : { background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{option.label}</button>
                    ))}
                  </div>
                </div>
              )}
              {!disabled && (
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }} aria-label="Move up"><ChevronUp className="w-4 h-4" /></button>
                  <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-30" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }} aria-label="Move down"><ChevronDown className="w-4 h-4" /></button>
                  <button type="button" onClick={() => removeBlock(index)} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }} aria-label="Remove attachment"><X className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 mt-3 flex items-center gap-2 rounded-xl px-2 py-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', boxShadow: '0 -4px 16px rgba(0,0,0,0.12)' }}>
        <button type="button" disabled={disabled} onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' }}><ImagePlus className="w-4 h-4" />Media</button>
        <button type="button" disabled={disabled} onClick={insertTextBlock} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}><Type className="w-4 h-4" />Text</button>
        <span className="hidden sm:flex items-center gap-1 text-[11px] ml-1" style={{ color: 'var(--text-ghost)' }}><Lock className="w-3 h-3" />Media is inserted at your cursor &amp; encrypted</span>
        <span className="sm:hidden text-[11px] ml-1" style={{ color: 'var(--text-ghost)' }}>Inserts at cursor</span>
        <span className="text-[11px] ml-auto flex-shrink-0" style={{ color: 'var(--text-ghost)' }}>{mediaCount}/{MAX_FILES_PER_ENTRY}</span>
      </div>
      <input ref={fileInputRef} type="file" multiple accept={MEDIA_ACCEPT} className="hidden" onChange={(e) => { insertFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
