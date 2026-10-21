import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";

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
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={save} className="panel w-full max-w-md space-y-4 p-7">
        <Logo />
        <h1 className="text-2xl font-bold uppercase">Set new password</h1>
        <Input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" />
        <Button variant="hero" className="w-full">Update password</Button>
      </form>
    </div>
  );
}
