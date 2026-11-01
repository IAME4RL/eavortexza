import { Link } from "@tanstack/react-router";
import { Menu, X, ScanLine } from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";
import { VortexBackground } from "./VortexBackground";
import { useAuth } from "@/lib/auth";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/scanner", label: "AI Chart Scanner", highlight: true },
  { to: "/features", label: "Features" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/faq", label: "FAQ" },
] as const;

const APP_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/dashboard/scanner", label: "AI Scanner" },
  { to: "/dashboard/auto-trade", label: "Auto Trade" },
  { to: "/dashboard/ea", label: "EA Management" },
  { to: "/dashboard/history", label: "Scan History" },
  { to: "/dashboard/market", label: "Market Analysis" },
] as const;

/** Same black / red portal look as the client dashboard header. */
export function SiteNav() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-50 border-b border-primary/20 bg-black/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: true }}
              className="pw-label flex items-center gap-1.5 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-primary"
            >
              {"highlight" in l && <ScanLine className="h-4 w-4 text-primary" />}
              {l.label}
              {"highlight" in l && (
                <span className="rounded border border-primary/40 px-1.5 py-px font-mono text-[10px] text-primary">FREE</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <Link to="/dashboard" className="pw-btn pw-btn-solid">Dashboard</Link>
          ) : (
            <>
              <Link to="/auth" className="pw-btn">Login</Link>
              <Link to="/auth" search={{ mode: "signup" }} className="pw-btn pw-btn-solid">Get Started</Link>
            </>
          )}
        </div>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 text-primary lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-primary/20 bg-sidebar lg:hidden">
          <nav className="flex flex-col px-4 py-3" aria-label="Mobile navigation">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
                className="pw-label rounded-md px-3 py-3 text-muted-foreground data-[status=active]:text-primary">
                {l.label}
              </Link>
            ))}
            <p className="pw-label mt-3 px-3 text-primary">Portal</p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {APP_LINKS.map((l) => (
                <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
                  className="pw-card-quiet px-3 py-3 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {user ? (
                <Link to="/dashboard" className="pw-btn pw-btn-solid col-span-2">Dashboard</Link>
              ) : (
                <>
                  <Link to="/auth" className="pw-btn" onClick={() => setOpen(false)}>Login</Link>
                  <Link to="/auth" search={{ mode: "signup" }} className="pw-btn pw-btn-solid" onClick={() => setOpen(false)}>Get Started</Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-primary/20 bg-black/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <Logo />
          <p className="pw-label mt-3 text-muted-foreground">Power your trading</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map((l) => <Link key={l.to} to={l.to} className="pw-label text-muted-foreground hover:text-primary">{l.label}</Link>)}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Risk warning: Trading forex, gold, indices and crypto involves substantial risk of loss.
          EA VORTEX provides AI-generated technical analysis for educational purposes only. It is not financial
          advice and does not guarantee any outcome.
        </p>
      </div>
      <div className="border-t border-primary/20 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} EA VORTEX
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <VortexBackground />
      <div className="pw-vignette" aria-hidden />
      <SiteNav />
      <main className="relative z-10 flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
