import React, { useEffect, useRef, useState } from 'react';
import { X, Undo2, Trash2, Check } from 'lucide-react';

const COLORS = ['#ffffff', '#ffd166', '#ef476f', '#06d6a0', '#4cc9f0', '#c4913a'];
const WIDTHS = [3, 6, 12];

/**
 * Full-screen handwriting/drawing pad. Strokes are exported as a PNG
 * image file and attached to the entry like any other image.
 */
export default function DrawingPad({ open, onClose, onSave }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const strokesRef = useRef([]);
  const currentRef = useRef(null);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [strokeCount, setStrokeCount] = useState(0);
  const settingsRef = useRef({ color: COLORS[0], width: WIDTHS[1] });
  settingsRef.current = { color, width };

  // Size the canvas to its container once opened.
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokesRef.current = [];
    setStrokeCount(0);
  }, [open ]);

  const pos = (e) => {
    const canvas = canvasRef.current;
    const r = canvas.getBoundingClientRect();
    const t = e.touches?.[0] ?? e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };

  const drawSegment = (a, b, c, w) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  const redrawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokesRef.current) {
      for (let i = 1; i < s.points.length; i++) drawSegment(s.points[i - 1], s.points[i], s.color, s.width);
      if (s.points.length === 1) drawSegment(s.points[0], s.points[0], s.color, s.width);
    }
  };

  const onDown = (e) => {
    if (e.cancelable) e.preventDefault();
    const { color: c, width: w } = settingsRef.current;
    currentRef.current = { color: c, width: w, points: [pos(e)] };
  };
  const onMove = (e) => {
    const cur = currentRef.current;
    if (!cur) return;
    if (e.cancelable) e.preventDefault();
    const p = pos(e);
    const prev = cur.points[cur.points.length - 1];
    cur.points.push(p);
    drawSegment(prev, p, cur.color, cur.width);
  };
  const onUp = () => {
    const cur = currentRef.current;
    if (!cur) return;
    currentRef.current = null;
    if (cur.points.length > 0) {
      strokesRef.current.push(cur);
      setStrokeCount(strokesRef.current.length);
    }
  };

  const undo = () => {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redrawAll();
  };
  const clear = () => {
    strokesRef.current = [];
    setStrokeCount(0);
    redrawAll();
  };

  const save = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      onSave(new File([blob], `drawing-${Date.now()}.png`, { type: 'image/png' }));
      onClose();
    }, 'image/png');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0b0b10' }}>
      {/* Top tools */}
      <div className="flex items-center gap-1 px-2 pt-3 pb-2 flex-shrink-0" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <button type="button" onClick={onClose} className="p-2.5 rounded-full cursor-pointer" style={{ color: '#fff' }} title="Close drawing">
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-6 h-6 rounded-full cursor-pointer"
              style={{ background: c, border: color === c ? '2px solid #fff' : '2px solid transparent' }}
              title="Pen color"
            />
          ))}
        </div>
        <button type="button" onClick={undo} disabled={strokeCount === 0} className="p-2.5 rounded-full cursor-pointer disabled:opacity-30" style={{ color: '#fff' }} title="Undo">
          <Undo2 className="w-5 h-5" />
        </button>
        <button type="button" onClick={clear} disabled={strokeCount === 0} className="p-2.5 rounded-full cursor-pointer disabled:opacity-30" style={{ color: '#fff' }} title="Clear all">
          <Trash2 className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={save}
          disabled={strokeCount === 0}
          className="ml-1 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-40 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #c4913a, #dba84a)', color: '#0c0c17' }}
          title="Attach drawing"
        >
          <Check className="w-5 h-5" />
        </button>
      </div>

      {/* Widths */}
      <div className="flex items-center justify-center gap-4 pb-2 flex-shrink-0">
        {WIDTHS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWidth(w)}
            className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
            style={{ background: width === w ? 'rgba(255,255,255,0.15)' : 'transparent' }}
            title="Pen size"
          >
            <span className="rounded-full" style={{ background: '#fff', width: `${w * 1.6}px`, height: `${w * 1.6}px` }} />
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div ref={wrapRef} className="flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ touchAction: 'none' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
        />
      </div>
    </div>
  );
}
