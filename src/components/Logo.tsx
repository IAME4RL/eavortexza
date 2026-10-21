import { Link } from "@tanstack/react-router";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="vx" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--primary-deep)" />
        </linearGradient>
      </defs>
      <path d="M20 2 L37 11 V29 L20 38 L3 29 V11 Z" fill="none" stroke="url(#vx)" strokeWidth="2" />
      <path d="M10 12 L20 30 L30 12" fill="none" stroke="var(--foreground)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 12 L20 22 L26 12" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="EA VORTEX home">
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-[0.12em]">
        EA <span className="text-primary">VORTEX</span>
      </span>
    </Link>
  );
}
