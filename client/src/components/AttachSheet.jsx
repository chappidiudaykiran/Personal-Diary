import React, { useEffect, useRef, useState } from 'react';
import { FileText, Mic, Image as ImageIcon, Camera, FileAudio, Square, X } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Bottom attach menu (Image / Camera / Voice recording / Audio file / PDF).
 * Fully working items only — every option attaches a real file to the entry.
 */
export default function AttachSheet({ open, onClose, onFiles }) {
  const imageRef = useRef(null);
  const cameraRef = useRef(null);
  const audioRef = useRef(null);
  const pdfRef = useRef(null);

  // ─── Voice recording (MediaRecorder → audio file) ──────────────────────────
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const stopTracks = () => {
    try { streamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch (_) {}
    streamRef.current = null;
  };

  useEffect(() => () => {
    try { recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop(); } catch (_) {}
    clearInterval(timerRef.current);
    stopTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async () => {
    if (recording) return;
    if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Voice recording is not supported on this device or browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => {
        try { return window.MediaRecorder.isTypeSupported(m); } catch (_) { return false; }
      });
      const rec = new window.MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        clearInterval(timerRef.current);
        stopTracks();
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        setRecSeconds(0);
        if (blob.size > 0) {
          const ext = (rec.mimeType || '').includes('mp4') ? 'm4a' : 'webm';
          onFiles([new File([blob], `voice-note.${ext}`, { type: blob.type || 'audio/webm' })]);
          onClose();
        } else {
          toast.error('Recording was empty — nothing attached.');
        }
      };
      rec.start();
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch (_) {
      stopTracks();
      toast.error('Microphone blocked — allow microphone access and try again.');
    }
  };

  const cancelRecording = () => {
    try { recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop(); } catch (_) {}
    // onstop would attach the file — detach it for a cancel.
    if (recorderRef.current) recorderRef.current.onstop = null;
    chunksRef.current = [];
    clearInterval(timerRef.current);
    stopTracks();
    setRecording(false);
    setRecSeconds(0);
  };

  if (!open) return null;

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const items = [
    { key: 'pdf', label: 'PDF', icon: FileText, onClick: () => pdfRef.current?.click() },
    { key: 'voice', label: 'Voice recording', icon: Mic, onClick: startRecording },
    { key: 'image', label: 'Image', icon: ImageIcon, onClick: () => imageRef.current?.click() },
    { key: 'camera', label: 'Camera', icon: Camera, onClick: () => cameraRef.current?.click() },
    { key: 'audio', label: 'Audio file', icon: FileAudio, onClick: () => audioRef.current?.click() },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-3xl px-3 pt-2 pb-6"
        style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-color)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto my-2" style={{ background: 'var(--border-color)' }} />
        {recording ? (
          <div className="flex items-center gap-3 px-3 py-3">
            <span className="w-3 h-3 rounded-full animate-pulse flex-shrink-0" style={{ background: '#e05555' }} />
            <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>Recording {fmt(recSeconds)}…</span>
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2.5 rounded-full cursor-pointer"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
              title="Cancel recording"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { try { recorderRef.current?.stop(); } catch (_) {} }}
              className="p-2.5 rounded-full cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' }}
              title="Stop and attach"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
        ) : (
          items.map((item, i) => (
            <div key={item.key}>
              <button
                type="button"
                onClick={item.onClick}
                className="w-full flex items-center gap-4 px-4 py-3.5 cursor-pointer text-left"
              >
                <item.icon className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <span className="text-[15px]" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
              </button>
              {i === 1 && <div className="mx-4 border-t border-dashed" style={{ borderColor: 'var(--border-color)' }} />}
            </div>
          ))
        )}
      </div>
      <input ref={imageRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      <input ref={pdfRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
