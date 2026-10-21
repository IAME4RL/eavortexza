import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex } from "@/lib/bridge";

/** Creates (or replaces) the bridge token for one of the caller's bots. The plain token is returned once only. */
export const createBridgeToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ botId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: bot } = await context.supabase.from("bots").select("id,user_id").eq("id", data.botId).maybeSingle();
    if (!bot || bot.user_id !== context.userId) throw new Error("Bot not found");
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = "evx_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("bots")
      .update({ bridge_token_hash: await sha256Hex(token), last_heartbeat: null, terminal_info: null })
      .eq("id", bot.id);
    if (error) throw new Error("Could not create token");
    return { token };
  });
