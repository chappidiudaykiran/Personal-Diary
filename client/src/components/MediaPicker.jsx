import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, X, FileText, FileAudio, FileVideo, File as FileIcon, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  MEDIA_ACCEPT,
  MAX_FILE_BYTES,
  MAX_FILES_PER_ENTRY,
  isSupportedFile,
  kindFromMime,
  formatFileSize,
} from '../api/mediaApi.js';

function FileKindIcon({ kind, className }) {
  if (kind === 'video') return <FileVideo className={className} />;
  if (kind === 'audio') return <FileAudio className={className} />;
  if (kind === 'pdf' || kind === 'file') return <FileText className={className} />;
  return <FileIcon className={className} />;
}

/**
 * Selects files to attach to an entry. Files stay local (as pending File
 * objects) until the entry is saved, at which point the parent encrypts
 * and uploads them one by one.
 */
export default function MediaPicker({ files, onChange, existingCount = 0, disabled = false }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        key: `${file.name}-${file.size}-${file.lastModified}`,
        kind: kindFromMime(file.type, file.name),
        url:
          file.type.startsWith('image/') || file.type.startsWith('video/')
            ? URL.createObjectURL(file)
            : null,
      })),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach((p) => {
        if (p.url) URL.revokeObjectURL(p.url);
      });
    };
  }, [previews]);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    const accepted = [];
    for (const file of incoming) {
      if (!isSupportedFile(file)) {
        toast.error(`"${file.name}" is not a supported file type`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`"${file.name}" is too large (max ${formatFileSize(MAX_FILE_BYTES)})`);
        continue;
      }
      if (files.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) {
        continue;
      }
      accepted.push(file);
    }

    const room = MAX_FILES_PER_ENTRY - existingCount - files.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_FILES_PER_ENTRY} files per entry`);
      return;
    }
    if (accepted.length > room) {
      toast.error(`Only ${room} more file${room === 1 ? '' : 's'} can be added`);
    }
    if (accepted.length > 0) {
      onChange([...files, ...accepted.slice(0, room)]);
    }
  };

  const removeFile = (index) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className="w-full flex flex-col items-center justify-center gap-2 rounded-xl px-4 py-6 text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: dragging ? 'var(--gold-glow)' : 'var(--bg-elevated)',
          border: `1px dashed ${dragging ? 'var(--border-bright)' : 'var(--border-color)'}`,
          color: 'var(--text-muted)',
        }}
      >
        <ImagePlus className="w-6 h-6" style={{ color: 'var(--gold)' }} />
        <span>
          Add photos, videos, audio or documents
          <span className="block text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>
            Click or drop files here · max {formatFileSize(MAX_FILE_BYTES)} each · up to {MAX_FILES_PER_ENTRY} files
          </span>
        </span>
        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-ghost)' }}>
          <Lock className="w-3 h-3" /> Encrypted on this device before upload
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={MEDIA_ACCEPT}
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {previews.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
          {previews.map((p, i) => (
            <div
              key={p.key}
              className="relative group rounded-lg overflow-hidden aspect-square"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
              title={`${p.file.name} (${formatFileSize(p.file.size)})`}
            >
              {p.url && p.kind === 'image' ? (
                <img src={p.url} alt={p.file.name} className="w-full h-full object-cover" />
              ) : p.url && p.kind === 'video' ? (
                <video src={p.url} className="w-full h-full object-cover" muted preload="metadata" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 px-2 text-center">
                  <FileKindIcon kind={p.kind} className="w-7 h-7" />
                  <span className="text-[10px] leading-tight line-clamp-2 break-all" style={{ color: 'var(--text-muted)' }}>
                    {p.file.name}
                  </span>
                </div>
              )}
              <span
                className="absolute bottom-0 inset-x-0 text-[10px] px-1.5 py-0.5 truncate"
                style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
              >
                {formatFileSize(p.file.size)}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeFile(i)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-50"
                style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                aria-label={`Remove ${p.file.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
