import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { VortexBackground } from "@/components/VortexBackground";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — EA VORTEX" },
      { name: "description", content: "Choose a new password for your EA VORTEX account." },
      { property: "og:title", content: "Reset password — EA VORTEX" },
      { property: "og:description", content: "Reset your EA VORTEX password." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4">
      <VortexBackground />
      <div className="pw-vignette" aria-hidden />
      <form onSubmit={save} className="pw-card relative z-10 w-full max-w-md space-y-4 p-7">
        <Logo />
        <h1 className="pw-title text-2xl">Set new password</h1>
        <Input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="pw-field" />
        <button type="submit" className="pw-btn pw-btn-solid w-full">Update password</button>
      </form>
    </div>
  );
}
