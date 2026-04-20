import { useEffect, useRef } from 'react';

// Math symbols
const MATH_SYMS = ['∑','∫','√','π','Δ','θ','∞','∂','φ','∇','α','β','ε','ω','σ','μ','≈','≠','≤','≥','∈','∉','⊂','∀','∃','±','÷','×','∝','⌀'];
// Science symbols
const SCI_SYMS  = ['λ','Ω','ħ','ρ','γ','E=mc²','F=ma','H₂O','CO₂','Fe','Na','⚛','⚡','🔬','℃','Δx','Δt','ΔE','v²','mg','qE'];
// Equations
const EQ_SYMS   = ['v=u+at','s=½at²','E=hf','PV=nRT','F=BIL','F=ma','a²+b²=c²','sin²θ+cos²θ=1','x=−b±√(b²−4ac)/2a'];

const ALL = [...MATH_SYMS, ...MATH_SYMS, ...SCI_SYMS, ...SCI_SYMS, ...EQ_SYMS];

function isDk() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

// ── Polygon mesh network types ────────────────────────────────────
interface MeshNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export default function Background() {
  const sciRef    = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const meshRaf   = useRef<number>(0);

  // ── Polygon mesh canvas ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const NODE_COUNT  = 18;
    const MAX_DIST    = 220;
    const nodes: MeshNode[] = [];

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialise nodes at random positions with slow random velocities
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x:  Math.random() * window.innerWidth,
        y:  Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
      });
    }

    const draw = () => {
      const dk = isDk();
      const lineColor = dk ? 'rgba(45,212,191,0.28)'  : 'rgba(13,148,136,0.35)';
      const dotColor  = dk ? 'rgba(45,212,191,0.40)'  : 'rgba(13,148,136,0.45)';

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update node positions with soft boundary bounce
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width)  n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        n.x = Math.max(0, Math.min(canvas.width,  n.x));
        n.y = Math.max(0, Math.min(canvas.height, n.y));
      }

      // Draw connecting lines
      ctx.strokeStyle = lineColor;
      ctx.lineWidth   = 0.8;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx   = nodes[i].x - nodes[j].x;
          const dy   = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST);
            ctx.globalAlpha = alpha * (dk ? 0.28 : 0.35);
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw node dots
      ctx.globalAlpha = 1;
      ctx.fillStyle = dotColor;
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      meshRaf.current = requestAnimationFrame(draw);
    };

    meshRaf.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(meshRaf.current);
    };
  }, []);

  // ── Floating symbols ─────────────────────────────────────────────
  useEffect(() => {
    const lay = sciRef.current;
    if (!lay) return;
    lay.innerHTML = '';
    const dk = isDk();
    const COUNT = 55;

    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement('span');
      el.className = 'sym';
      const sym = ALL[Math.floor(Math.random() * ALL.length)];
      el.textContent = sym;

      const isEq = EQ_SYMS.includes(sym);
      // Increased sizes: equations 14-22px, regular 16-34px
      const sz = isEq
        ? (14 + Math.random() * 8).toFixed(1)
        : (16 + Math.random() * 18).toFixed(1);

      // Color — teal-green family with occasional accent
      const hue = 160 + Math.floor(Math.random() * 40);
      const sat = dk ? 50 + Math.floor(Math.random() * 20) : 45 + Math.floor(Math.random() * 20);
      // Darker on light mode for visibility (was 28+18, now 20+18)
      const lit = dk ? 50 + Math.floor(Math.random() * 18) : 20 + Math.floor(Math.random() * 18);
      const opA = dk ? (0.22 + Math.random() * 0.18) : (0.28 + Math.random() * 0.20);
      const opB = Math.min(opA + 0.12, dk ? 0.55 : 0.55);
      const colBase = `hsla(${hue},${sat}%,${lit}%,${opB.toFixed(3)})`;
      const colGlow = `hsla(${hue},${sat}%,${lit}%,${(opB * 0.4).toFixed(3)})`;

      // Animation params
      const dur   = (18 + Math.random() * 22).toFixed(2);
      const del   = (-(Math.random() * 30)).toFixed(2);
      const wx    = (3 + Math.random() * 14).toFixed(1);
      const rt    = ((Math.random() - 0.5) * 5).toFixed(2);
      const y1    = (-(8 + Math.random() * 20)).toFixed(1);
      const y2    = (-(4 + Math.random() * 16)).toFixed(1);
      const y3    = (-(18 + Math.random() * 26)).toFixed(1);
      const pulse = (2 + Math.random() * 3).toFixed(2);

      el.style.cssText = [
        `left:${(Math.random() * 98).toFixed(1)}%`,
        `top:${(Math.random() * 115).toFixed(1)}%`,
        `font-size:${sz}px`,
        `color:${colBase}`,
        `text-shadow:0 0 14px ${colBase},0 0 32px ${colGlow}`,
        `--sd:${dur}s`, `--dl:${del}s`, `--wx:${wx}px`, `--rt:${rt}deg`,
        `--y1:${y1}px`, `--y2:${y2}px`, `--y3:${y3}px`,
        `--oa:${opA.toFixed(3)}`, `--ob:${opB.toFixed(3)}`,
        `--ps:${pulse}s`,
      ].join(';');
      lay.appendChild(el);
    }

    // Parallax on mouse move
    let tX = 0, tY = 0, cX = 0, cY = 0;
    const onMove = (e: MouseEvent) => {
      tX = (e.clientX / window.innerWidth - 0.5) * 16;
      tY = (e.clientY / window.innerHeight - 0.5) * 12;
    };
    document.addEventListener('mousemove', onMove);

    const tick = () => {
      cX += (tX - cX) * 0.022;
      cY += (tY - cY) * 0.022;
      if (lay) lay.style.transform = `translate(${cX.toFixed(2)}px,${cY.toFixed(2)}px)`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      <div id="bgc">
        <div className="bb bb1" />
        <div className="bb bb2" />
        <div className="bb bb3" />
        <div className="bb bb4" />
        <div className="bb bb5" />
        <div className="bb bb6" />
      </div>
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      />
      <div id="sci" ref={sciRef} />
    </>
  );
}
