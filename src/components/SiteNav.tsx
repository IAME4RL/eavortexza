import { Link } from "@tanstack/react-router";
import { Menu, X, ScanLine } from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";
import { Button } from "./ui/button";
import { VortexBackground } from "./VortexBackground";
import { useAuth } from "@/lib/auth";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/scanner", label: "AI Chart Scanner", highlight: true },
  { to: "/features", label: "Features" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/faq", label: "FAQ" },
] as const;

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: true }}
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-primary"
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
            <Button variant="hero" asChild><Link to="/dashboard">Dashboard</Link></Button>
          ) : (
            <>
              <Button variant="ghost" asChild><Link to="/auth">Login</Link></Button>
              <Button variant="hero" asChild><Link to="/auth" search={{ mode: "signup" }}>Get Started</Link></Button>
            </>
          )}
        </div>
        <button className="lg:hidden p-2" aria-label="Toggle menu" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-surface lg:hidden">
          <nav className="flex flex-col px-4 py-3">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm text-muted-foreground data-[status=active]:text-primary">
                {l.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {user ? (
                <Button variant="hero" className="col-span-2" asChild><Link to="/dashboard">Dashboard</Link></Button>
              ) : (
                <>
                  <Button variant="frame" asChild><Link to="/auth">Login</Link></Button>
                  <Button variant="hero" asChild><Link to="/auth" search={{ mode: "signup" }}>Get Started</Link></Button>
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
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted-foreground">Power Your Trading.</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {LINKS.map((l) => <Link key={l.to} to={l.to} className="hover:text-foreground">{l.label}</Link>)}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Risk warning: Trading forex, gold, indices and crypto involves substantial risk of loss.
          EA VORTEX provides AI-generated technical analysis for educational purposes only. It is not financial
          advice and does not guarantee any outcome.
        </p>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} EA VORTEX
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <VortexBackground />
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
