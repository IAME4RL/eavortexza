import { cn } from "@/lib/utils";

/**
 * Hero artwork for the client Home screen: the EA VORTEX hexagon inside slowly
 * turning rings, with faint candlesticks along the bottom. Pure SVG, no assets.
 */
export function VortexHero({ className }: { className?: string }) {
  const candles = [
    [30, 218, 40, 12], [58, 226, 26, 16], [86, 208, 44, 10], [114, 214, 32, 14], [142, 198, 52, 12],
    [258, 200, 50, 12], [286, 214, 34, 14], [314, 204, 46, 10], [342, 222, 28, 16], [370, 210, 40, 12],
  ] as const;
  return (
    <div className={cn("relative overflow-hidden rounded-[1.15rem] bg-black", className)}>
      <svg viewBox="0 0 400 270" className="block h-full w-full" role="img" aria-label="EA VORTEX">
        <defs>
          <radialGradient id="vh-glow" cx="50%" cy="46%" r="55%">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="var(--primary-deep)" stopOpacity="0.22" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="vh-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="vh-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--primary-deep)" />
          </linearGradient>
        </defs>
        <rect width="400" height="270" fill="#030303" />
        <rect width="400" height="270" fill="url(#vh-glow)" />
        {candles.map(([x, y, h, w], i) => (
          <g key={x} opacity={0.28 + (i % 3) * 0.08}>
            <line x1={x + w / 2} x2={x + w / 2} y1={y - 12} y2={y + h + 12} stroke="var(--primary)" strokeWidth="1" />
            <rect x={x} y={y} width={w} height={h} fill={i % 2 ? "var(--primary)" : "none"} stroke="var(--primary)" strokeWidth="1.2" />
          </g>
        ))}
        <g transform="translate(200 128)">
          <g className="pw-spin">
            <ellipse rx="150" ry="52" fill="none" stroke="var(--primary)" strokeOpacity="0.5" strokeWidth="1.2" strokeDasharray="2 7" transform="rotate(-18)" />
            <ellipse rx="122" ry="40" fill="none" stroke="var(--primary)" strokeOpacity="0.7" strokeWidth="1.4" transform="rotate(24)" />
          </g>
          <g className="pw-spin pw-spin-rev">
            <ellipse rx="96" ry="30" fill="none" stroke="var(--primary)" strokeOpacity="0.85" strokeWidth="1.6" strokeDasharray="14 10" transform="rotate(62)" />
            <circle r="72" fill="none" stroke="var(--primary-deep)" strokeOpacity="0.8" strokeWidth="1" />
          </g>
          <g transform="scale(2.2) translate(-20 -20)">
            <path d="M20 2 L37 11 V29 L20 38 L3 29 V11 Z" fill="#050000" stroke="url(#vh-stroke)" strokeWidth="1.8" />
            <path d="M10 12 L20 30 L30 12" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M14 12 L20 22 L26 12" fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinejoin="round" />
          </g>
        </g>
        <rect width="400" height="270" fill="url(#vh-fade)" />
        <text x="388" y="258" textAnchor="end" fontFamily="var(--font-display)" fontSize="9" letterSpacing="2.4" fill="var(--primary)" fillOpacity="0.9">EA VORTEX</text>
      </svg>
    </div>
  );
}
