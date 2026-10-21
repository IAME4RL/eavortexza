import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/Logo";
import { VortexBackground } from "@/components/VortexBackground";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => z.object({ mode: z.enum(["signin", "signup"]).optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — EA VORTEX" },
      { name: "description", content: "Sign in or create your free EA VORTEX account." },
      { property: "og:title", content: "Sign in — EA VORTEX" },
      { property: "og:description", content: "Access your EA VORTEX trading dashboard." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initial } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initial ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mentor, setMentor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => { if (user) navigate({ to: "/dashboard", replace: true }); }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { display_name: name, mentor_requested: mentor } },
        });
        if (error) throw error;
        if (!data.session) setSent("Check your email to confirm your account, then sign in.");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        setSent("If an account exists for that email, a reset link is on its way.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="panel p-7 red-glow-soft">
          <h1 className="text-2xl font-bold uppercase">
            {mode === "signup" ? "Create free account" : mode === "forgot" ? "Reset password" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? "Free forever. No subscription required." : mode === "forgot" ? "We'll email you a reset link." : "Sign in to your EA VORTEX dashboard."}
          </p>
          {sent ? (
            <p className="mt-6 rounded-md border border-primary/40 bg-accent p-4 text-sm">{sent}</p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <div><Label htmlFor="n">Display name</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} className="mt-1.5" /></div>
              )}
              <div><Label htmlFor="e">Email</Label><Input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" /></div>
              {mode !== "forgot" && (
                <div><Label htmlFor="p">Password</Label><Input id="p" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5" /></div>
              )}
              {mode === "signup" && (
                <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
                  <Checkbox checked={mentor} onCheckedChange={(v) => setMentor(v === true)} className="mt-0.5" />
                  <span><span className="font-semibold">I'm a mentor</span><br /><span className="text-muted-foreground">Request mentor access. An administrator must approve it.</span></span>
                </label>
              )}
              <Button variant="hero" size="xl" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
              </Button>
            </form>
          )}
          {mode !== "forgot" && !sent && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />OR<span className="h-px flex-1 bg-border" /></div>
              <Button variant="frame" className="w-full" onClick={google}>Continue with Google</Button>
            </>
          )}
          <div className="mt-6 flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                <button className="hover:text-primary" onClick={() => setMode("signup")}>Create an account</button>
                <button className="hover:text-primary" onClick={() => setMode("forgot")}>Forgot password?</button>
              </>
            ) : (
              <button className="hover:text-primary" onClick={() => { setMode("signin"); setSent(null); }}>Back to sign in</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
