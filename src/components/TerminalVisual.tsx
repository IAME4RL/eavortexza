import { Cpu } from "lucide-react";

// Deterministic illustrative candles (not real market data).
function makeCandles(n: number) {
  const out: { o: number; c: number; h: number; l: number }[] = [];
  let p = 50;
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    const drift = i < 14 ? -0.6 : i < 22 ? 0.2 : 1.1;
    const o = p;
    const c = o + drift + (rnd() - 0.5) * 6;
    const h = Math.max(o, c) + rnd() * 3;
    const l = Math.min(o, c) - rnd() * 3;
    out.push({ o, c, h, l });
    p = c;
  }
  return out;
}

export function TerminalVisual() {
  const candles = makeCandles(40);
  const W = 560, H = 300;
  const max = Math.max(...candles.map((c) => c.h)) + 4;
  const min = Math.min(...candles.map((c) => c.l)) - 4;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const cw = W / candles.length;
  const support = min + (max - min) * 0.22;
  const resistance = min + (max - min) * 0.78;

  return (
    <div className="relative">
      <div className="absolute -inset-10 radial-red blur-2xl" aria-hidden />
      <div className="relative panel overflow-hidden red-glow-soft">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" />
            <span className="font-mono text-sm font-semibold">XAUUSD</span>
            <span className="hidden font-mono text-xs text-muted-foreground sm:inline">GOLD · SPOT</span>
          </div>
          <div className="flex gap-1 font-mono text-[11px]">
            {["M5", "M15", "H1", "H4", "D1"].map((t) => (
              <span key={t} className={`rounded px-2 py-1 ${t === "H1" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</span>
            ))}
          </div>
        </div>
        <div className="relative grid-bg">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Illustrative candlestick chart">
            <line x1="0" x2={W} y1={y(resistance)} y2={y(resistance)} stroke="var(--primary)" strokeDasharray="6 5" strokeWidth="1" />
            <line x1="0" x2={W} y1={y(support)} y2={y(support)} stroke="var(--bull)" strokeDasharray="6 5" strokeWidth="1" />
            <text x="8" y={y(resistance) - 6} fill="var(--primary)" fontSize="10" fontFamily="var(--font-mono)">RESISTANCE ZONE</text>
            <text x="8" y={y(support) + 14} fill="var(--bull)" fontSize="10" fontFamily="var(--font-mono)">SUPPORT ZONE</text>
            <polyline
              fill="none" stroke="var(--muted-foreground)" strokeOpacity=".6" strokeWidth="1.5"
              points={candles.map((c, i) => `${i * cw + cw / 2},${y((c.o + c.c) / 2 + 1)}`).join(" ")}
            />
            {candles.map((c, i) => {
              const up = c.c >= c.o;
              const col = up ? "var(--bull)" : "var(--primary)";
              const x = i * cw + cw / 2;
              return (
                <g key={i}>
                  <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth="1" />
                  <rect x={x - cw * 0.32} width={cw * 0.64} y={y(Math.max(c.o, c.c))}
                    height={Math.max(1.5, Math.abs(y(c.o) - y(c.c)))} fill={col} />
                </g>
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-primary/15 to-transparent animate-scanline" />
          <div className="absolute bottom-3 right-3 w-52 rounded-lg border border-primary/40 bg-background/90 p-3 backdrop-blur sm:w-60">
            <div className="flex items-center gap-2 text-xs font-semibold"><Cpu className="h-3.5 w-3.5 text-primary" /> AI ANALYSIS</div>
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
              <li><span className="text-bull">▲</span> Higher lows forming</li>
              <li><span className="text-primary">■</span> Testing resistance zone</li>
              <li><span className="text-neutral">●</span> Await breakout confirmation</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Illustrative demo · not live market data
        </div>
      </div>
    </div>
  );
}
