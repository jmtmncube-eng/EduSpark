import { useEffect, useRef, useState } from 'react';

/**
 * Interactive diagram viewer.
 *
 * Inline mode:
 *   • A responsive thumbnail with a "🔍 Tap to enlarge" affordance.
 *   • `loading="lazy"` so off-screen diagrams don't block the page.
 *
 * Fullscreen mode (when clicked):
 *   • Pan (drag to move when zoomed in)
 *   • Zoom (+/- buttons · scroll wheel · pinch · double-tap)
 *   • Reset to fit-to-screen
 *   • Open in new tab (browser's own download lives there)
 *   • ESC or backdrop click to close
 *
 * Works for base64 data-URLs (current Question.imageData) and remote URLs.
 */

interface Props {
  src: string;
  alt?: string;
  maxThumbHeight?: number;  // px — caps inline render so it never crowds text
  className?: string;
  caption?: string;         // optional one-liner under the thumbnail
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.25;

export default function DiagramViewer({ src, alt, maxThumbHeight = 280, className, caption }: Props) {
  const [open, setOpen] = useState(false);

  if (!src) return null;
  return (
    <>
      {/* Inline thumbnail — clickable */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        aria-label="Open diagram"
        style={{
          display: 'block', cursor: 'zoom-in', padding: 0,
          background: 'transparent', border: 0, width: '100%',
          textAlign: 'left',
        }}
      >
        <div style={{
          position: 'relative', overflow: 'hidden',
          borderRadius: 10, border: '1px solid var(--bd)',
          background: 'var(--bg)',
        }}>
          <img
            src={src}
            alt={alt ?? 'Diagram'}
            loading="lazy"
            decoding="async"
            style={{
              display: 'block', width: '100%', height: 'auto',
              maxHeight: maxThumbHeight, objectFit: 'contain',
              background: '#fff',
            }}
          />
          {/* Hover/tap affordance */}
          <div
            aria-hidden
            style={{
              position: 'absolute', top: 6, right: 6,
              background: 'rgba(15,23,42,.72)', color: '#fff',
              fontSize: 10.5, fontWeight: 700,
              padding: '3px 8px', borderRadius: 99,
              letterSpacing: '.04em', pointerEvents: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            🔍 Tap to enlarge
          </div>
        </div>
        {caption && (
          <div className="xs ct3" style={{ marginTop: 4, fontStyle: 'italic' }}>{caption}</div>
        )}
      </button>

      {open && <Fullscreen src={src} alt={alt} caption={caption} onClose={() => setOpen(false)} />}
    </>
  );
}

// ─── Fullscreen modal with zoom + pan ────────────────────────────
function Fullscreen({ src, alt, caption, onClose }: { src: string; alt?: string; caption?: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  // Pan tracking
  const dragging = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') setScale((s) => clamp(s * ZOOM_STEP));
      else if (e.key === '-') setScale((s) => clamp(s / ZOOM_STEP));
      else if (e.key === '0') reset();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  function clamp(s: number) { return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s)); }
  function reset() { setScale(1); setTx(0); setTy(0); }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const next = clamp(scale * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
    setScale(next);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      dragging.current = true;
      lastPt.current = { x: e.clientX, y: e.clientY };
    } else if (pointers.current.size === 2) {
      // Begin pinch
      const pts = Array.from(pointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchStart.current = { dist: Math.hypot(dx, dy), scale };
      dragging.current = false; // pause pan during pinch
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const pts = Array.from(pointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const next = clamp((dist / pinchStart.current.dist) * pinchStart.current.scale);
      setScale(next);
      return;
    }

    if (dragging.current && lastPt.current) {
      const dx = e.clientX - lastPt.current.x;
      const dy = e.clientY - lastPt.current.y;
      lastPt.current = { x: e.clientX, y: e.clientY };
      setTx((t) => t + dx);
      setTy((t) => t + dy);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      dragging.current = false;
      lastPt.current = null;
    }
  }

  // Double-tap / double-click → toggle 1 ↔ 2 zoom
  const lastTap = useRef(0);
  function onTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (scale > 1.05) reset(); else setScale(2);
    }
    lastTap.current = now;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Diagram'}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(2,6,23,.92)',
        display: 'flex', flexDirection: 'column',
        touchAction: 'none',  // we drive zoom/pan ourselves
      }}
    >
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'rgba(0,0,0,.4)', color: '#fff',
        fontSize: 13,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16 }}>🖼</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {alt || 'Diagram'} {caption ? `· ${caption}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setScale((s) => clamp(s / ZOOM_STEP))} style={btnStyle} aria-label="Zoom out">−</button>
          <div style={{ minWidth: 46, textAlign: 'center', fontSize: 12 }}>{Math.round(scale * 100)}%</div>
          <button onClick={() => setScale((s) => clamp(s * ZOOM_STEP))} style={btnStyle} aria-label="Zoom in">+</button>
          <button onClick={reset} style={btnStyle} aria-label="Reset">↺</button>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            style={{ ...btnStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            aria-label="Open in new tab"
            title="Open in new tab"
          >↗</a>
          <button onClick={onClose} style={{ ...btnStyle, background: 'rgba(239,68,68,.85)' }} aria-label="Close">✕</button>
        </div>
      </div>

      {/* Image canvas */}
      <div
        onWheel={onWheel}
        onPointerDown={(e) => { onPointerDown(e); onTap(); }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          flex: 1, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: scale > 1 ? (dragging.current ? 'grabbing' : 'grab') : 'zoom-in',
          userSelect: 'none', touchAction: 'none',
        }}
      >
        <img
          src={src}
          alt={alt ?? 'Diagram'}
          draggable={false}
          style={{
            maxWidth: '100%', maxHeight: '100%',
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: dragging.current || pinchStart.current ? 'none' : 'transform .15s ease-out',
            background: '#fff', borderRadius: 6,
            boxShadow: '0 10px 60px rgba(0,0,0,.4)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Footer hint */}
      <div style={{
        padding: '6px 14px',
        background: 'rgba(0,0,0,.3)', color: 'rgba(255,255,255,.7)',
        fontSize: 10.5, textAlign: 'center', letterSpacing: '.04em',
      }}>
        Scroll / pinch to zoom · Drag to pan · Double-tap to reset · Esc to close
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,.16)',
  color: '#fff',
  border: 0,
  borderRadius: 8,
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1,
  minWidth: 32,
};
