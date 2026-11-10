/**
 * Server-only access to each client's own API2Trade API key (table cloud_api_keys).
 * The table has row-level security on and NO policies, so the browser can never read or write it:
 * only server code using the service-role client reaches it, and keys are never returned to the page.
 */
type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
// The table is newer than the generated database types, so go through a narrow cast.
const table = (db: Db) => (db as unknown as { from: (t: string) => any }).from("cloud_api_keys");

/** A key is a long opaque token. Reject anything that cannot be one (spaces, too short, too long). */
export function validApiKey(raw: string): string | null {
  const k = raw.trim();
  return k.length >= 16 && k.length <= 256 && !/\s/.test(k) ? k : null;
}

export async function loadApiKey(db: Db, userId: string): Promise<string | null> {
  const { data } = await table(db).select("api_key").eq("user_id", userId).maybeSingle();
  const k = (data as { api_key?: unknown } | null)?.api_key;
  return typeof k === "string" && k ? k : null;
}

export async function hasApiKey(db: Db, userId: string): Promise<{ hasKey: boolean; last4: string | null }> {
  const k = await loadApiKey(db, userId);
  return { hasKey: !!k, last4: k ? k.slice(-4) : null };
}

export async function saveApiKey(db: Db, userId: string, key: string): Promise<void> {
  const { error } = await table(db).upsert({ user_id: userId, api_key: key, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error("Could not save your API key.");
}

export async function deleteApiKey(db: Db, userId: string): Promise<void> {
  await table(db).delete().eq("user_id", userId);
}

export const NO_KEY_MESSAGE = "Add your API2Trade API key under Cloud trading first.";
