import { useEffect, useRef } from "react";

/**
 * EA VORTEX ambient background: drifting red particles, flowing market-price
 * lines, faint candlesticks and a digital grid over a soft red ambient glow.
 * Renders on a fixed canvas behind all content; honours prefers-reduced-motion.
 */
export function VortexBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    interface Particle { x: number; y: number; r: number; vx: number; vy: number; a: number; }
    interface Candle { x: number; o: number; c: number; hi: number; lo: number; up: boolean; }
    let particles: Particle[] = [];
    let candles: Candle[] = [];
    let price: number[] = [];

    const RED = "255, 48, 48";

    function resize() {
      if (!canvas || !ctx) return;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const n = Math.min(70, Math.floor((w * h) / 26000));
      particles = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.16,
        vy: -0.06 - Math.random() * 0.22,
        a: 0.12 + Math.random() * 0.3,
      }));

      const cw = 26;
      const count = Math.ceil(w / cw) + 2;
      let p = 0.5;
      candles = Array.from({ length: count }, (_, i) => {
        const o = p;
        p = Math.min(0.92, Math.max(0.08, p + (Math.random() - 0.5) * 0.09));
        const c = p;
        return {
          x: i * cw,
          o, c,
          hi: Math.max(o, c) + Math.random() * 0.03,
          lo: Math.min(o, c) - Math.random() * 0.03,
          up: c >= o,
        };
      });

      price = Array.from({ length: 160 }, (_, i) => 0.5 + Math.sin(i / 14) * 0.12 + (Math.random() - 0.5) * 0.05);
    }

    function drawGrid() {
      if (!ctx) return;
      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.lineWidth = 1;
      const step = 56;
      ctx.beginPath();
      for (let x = 0; x <= w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = 0; y <= h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
    }

    function drawCandles(t: number) {
      if (!ctx) return;
      const bandH = h * 0.34;
      const baseY = h * 0.62;
      const drift = (t * 0.008) % 26;
      for (const cd of candles) {
        const x = cd.x - drift;
        const y = (v: number) => baseY - v * bandH;
        const alpha = 0.05;
        ctx.strokeStyle = cd.up ? `rgba(120,220,160,${alpha})` : `rgba(${RED},${alpha + 0.02})`;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 5, y(cd.hi));
        ctx.lineTo(x + 5, y(cd.lo));
        ctx.stroke();
        const top = y(Math.max(cd.o, cd.c));
        const bh = Math.max(2, Math.abs(y(cd.o) - y(cd.c)));
        ctx.fillRect(x, top, 10, bh);
      }
    }

    function drawPriceLine(t: number) {
      if (!ctx) return;
      // slowly evolve the series
      if (Math.floor(t / 120) !== Math.floor((t - 16) / 120)) {
        price.shift();
        const last = price[price.length - 1] ?? 0.5;
        price.push(Math.min(0.95, Math.max(0.05, last + (Math.random() - 0.5) * 0.05)));
      }
      const midY = h * 0.4;
      const amp = h * 0.16;
      const stepX = w / (price.length - 1);
      for (const [alpha, width, offset] of [[0.28, 1.4, 0], [0.1, 1, 26]] as const) {
        ctx.beginPath();
        price.forEach((v, i) => {
          const x = i * stepX;
          const y = midY + offset - v * amp + Math.sin(t / 900 + i / 6) * 6;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = `rgba(${RED},${alpha})`;
        ctx.lineWidth = width;
        ctx.stroke();
      }
    }

    function drawParticles() {
      if (!ctx) return;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
        if (p.x < -4) p.x = w + 4;
        if (p.x > w + 4) p.x = -4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${RED},${p.a})`;
        ctx.fill();
      }
    }

    let t = 0;
    function frame() {
      if (!ctx) return;
      t += 16;
      ctx.clearRect(0, 0, w, h);
      drawGrid();
      drawCandles(t);
      drawPriceLine(t);
      drawParticles();
      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    if (reduced) {
      // single static frame for reduced-motion users
      drawGrid(); drawCandles(0); drawPriceLine(0); drawParticles();
    } else {
      raf = requestAnimationFrame(frame);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* ambient red glow + moving gradient wash */}
      <div className="absolute inset-0 radial-red" />
      <div className="vortex-wash absolute inset-0" />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      {/* vignette to keep content legible */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--background)_100%)] opacity-70" />
    </div>
  );
}
