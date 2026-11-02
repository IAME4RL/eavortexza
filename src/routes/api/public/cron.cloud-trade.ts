import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled engine for cloud (API2Trade) auto trading. Call it about once a minute with
 * `Authorization: Bearer <LOVABLE_CRON_SECRET>`. Each call evaluates every running cloud bot once.
 */
async function handle(request: Request): Promise<Response> {
  const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
  const denied = await authenticateCronRequest(request);
  if (denied) return denied;
  const { runCloudCycle } = await import("@/lib/cloudEngine");
  const summary = await runCloudCycle();
  return new Response(JSON.stringify(summary), { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export const Route = createFileRoute("/api/public/cron/cloud-trade")({
  server: { handlers: { POST: ({ request }) => handle(request), GET: ({ request }) => handle(request) } },
});
