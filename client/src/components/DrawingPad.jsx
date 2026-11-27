import React, { useEffect, useRef, useState } from 'react';
import { X, Undo2, Trash2, Check, Pen, Eraser, Minus, Plus, Hand } from 'lucide-react';

const COLORS = ['#ffffff', '#ffd166', '#ef476f', '#06d6a0', '#4cc9f0', '#c4913a'];
const MIN_W = 1;
const MAX_W = 30;

/**
 * Full-screen handwriting/drawing pad. Strokes are exported as a PNG
 * image file and attached to the entry like any other image.
 *
 * Coordinates are stored in device pixels and rescaled on resize, with
 * every stroke mapped through the canvas's live bounding rect — so the
 * ink always lands exactly under the finger, on any screen.
 */
export default function DrawingPad({ open, onClose, onSave }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const strokesRef = useRef([]);
  const currentRef = useRef(null);
  const scaleRef = useRef({ x: 1, y: 1 });
  const [tool, setTool] = useState('pen');
  const [mode, setMode] = useState('draw'); // 'draw' | 'scroll'
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(6);
  const [strokeCount, setStrokeCount] = useState(0);
  const settingsRef = useRef({ tool: 'pen', color: COLORS[0], width: 6 });
  settingsRef.current = { tool, color, width };

  // Tall scrollable page (2.5 screens). Points are rescaled on resize so the
  // drawing survives rotation without shifting.
  const PAGE_FACTOR = 2.5;

  // Size the canvas to its container. Points are rescaled so the
  // drawing survives rotation/resize without shifting.
  const sizeCanvas = (preserve) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(wrap.clientWidth));
    const h = Math.max(1, Math.floor(wrap.clientHeight * PAGE_FACTOR));
    if (preserve && canvas.width > 1 && canvas.height > 1) {
      const sx = (w * dpr) / canvas.width;
      const sy = (h * dpr) / canvas.height;
      for (const s of strokesRef.current) {
        for (const p of s.points) { p.x *= sx; p.y *= sy; }
        s.width *= (sx + sy) / 2;
      }
    }
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    scaleRef.current = { x: canvas.width / w, y: canvas.height / h };
    redrawAll();
  };

  useEffect(() => {
    if (!open) return;
    strokesRef.current = [];
    setStrokeCount(0);
    // Wait a frame so the overlay has laid out before measuring.
    const t = requestAnimationFrame(() => sizeCanvas(false));
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  const handleResize = () => sizeCanvas(true);

  // Map the pointer through the canvas's live rect into device pixels.
  const toDevice = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const r = canvas.getBoundingClientRect();
    const sx = r.width > 0 ? canvas.width / r.width : 1;
    const sy = r.height > 0 ? canvas.height / r.height : 1;
    scaleRef.current = { x: sx, y: sy };
    return { x: (clientX - r.left) * sx, y: (clientY - r.top) * sy };
  };

  const paintStroke = (s) => {
    const canvas = canvasRef.current;
    if (!canvas || s.points.length === 0) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = s.color;
    // Width stored in CSS px → convert with the live horizontal scale.
    ctx.lineWidth = Math.max(1, s.width * scaleRef.current.x);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
    // A single tap still leaves a dot.
    if (s.points.length === 1) ctx.lineTo(s.points[0].x + 0.5, s.points[0].y + 0.5);
    ctx.stroke();
    ctx.restore();
  };

  const redrawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokesRef.current) paintStroke(s);
  };

  const pointFromEvent = (e) => {
    const t = e.touches?.[0] ?? e;
    return toDevice(t.clientX, t.clientY);
  };

  const onDown = (e) => {
    if (mode !== 'draw') return; // scroll mode: let the page scroll
    if (e.cancelable) e.preventDefault();
    const { tool: t, color: c, width: w } = settingsRef.current;
    currentRef.current = { tool: t, color: c, width: w, points: [pointFromEvent(e)] };
  };
  const onMove = (e) => {
    const cur = currentRef.current;
    if (!cur) return;
    if (e.cancelable) e.preventDefault();
    cur.points.push(pointFromEvent(e));
    const n = cur.points.length;
    if (n >= 2) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = cur.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = cur.color;
      ctx.lineWidth = Math.max(1, cur.width * scaleRef.current.x);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cur.points[n - 2].x, cur.points[n - 2].y);
      ctx.lineTo(cur.points[n - 1].x, cur.points[n - 1].y);
      ctx.stroke();
      ctx.restore();
    }
  };
  const onUp = () => {
    const cur = currentRef.current;
    if (!cur) return;
    currentRef.current = null;
    // A tap without moving still leaves a dot.
    if (cur.points.length === 1) paintStroke(cur);
    strokesRef.current.push(cur);
    setStrokeCount(strokesRef.current.length);
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
              onClick={() => { setColor(c); setTool('pen'); }}
              className="w-6 h-6 rounded-full cursor-pointer"
              style={{ background: c, border: color === c && tool === 'pen' ? '2px solid #fff' : '2px solid transparent' }}
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

      {/* Pen / eraser / scroll + size stepper */}
      <div className="flex items-center justify-center gap-3 pb-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'draw' ? 'scroll' : 'draw'))}
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
          style={{ background: mode === 'scroll' ? 'rgba(255,255,255,0.15)' : 'transparent', color: '#fff' }}
          title={mode === 'draw' ? 'Scroll mode: swipe to move around the page' : 'Draw mode'}
        >
          <Hand className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => { setTool('pen'); setMode('draw'); }}
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
          style={{ background: tool === 'pen' ? 'rgba(255,255,255,0.15)' : 'transparent', color: '#fff' }}
          title="Pen"
        >
          <Pen className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => { setTool('eraser'); setMode('draw'); }}
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
          style={{ background: tool === 'eraser' ? 'rgba(255,255,255,0.15)' : 'transparent', color: '#fff' }}
          title="Eraser"
        >
          <Eraser className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1 rounded-full px-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <button
            type="button"
            onClick={() => setWidth((w) => Math.max(MIN_W, w - 1))}
            disabled={width <= MIN_W}
            className="p-2 rounded-full cursor-pointer disabled:opacity-30"
            style={{ color: '#fff' }}
            title="Thinner"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="rounded-full flex-shrink-0" style={{ background: '#fff', width: `${Math.min(22, 4 + width)}px`, height: `${Math.min(22, 4 + width)}px` }} />
          <button
            type="button"
            onClick={() => setWidth((w) => Math.min(MAX_W, w + 1))}
            disabled={width >= MAX_W}
            className="p-2 rounded-full cursor-pointer disabled:opacity-30"
            style={{ color: '#fff' }}
            title="Thicker"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas — tall scrollable page */}
      <div ref={wrapRef} className="flex-1 min-h-0 overflow-y-auto">
        <canvas
          ref={canvasRef}
          className="w-full block"
          style={{ height: '250%', touchAction: mode === 'scroll' ? 'pan-y' : 'none' }}
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
