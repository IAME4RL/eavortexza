import { supabase } from "@/integrations/supabase/client";

// The generated Supabase Database type in this project predates these tables.
// Keep this boundary typed locally until `supabase gen types` is run again.
const db = supabase as any;

export type MentorBotRecord = {
  id: string;
  mentor_id: string;
  name: string;
  mentor_name: string;
  description: string;
  strategies: string;
  avatar_url: string | null;
  background_url: string | null;
  created_at: string;
};

export type MentorLicenseRecord = {
  id: string;
  license_key: string;
  client_name: string;
  client_email: string;
  bot_id: string;
  status: "active" | "redeemed" | "revoked";
  created_at: string;
  bot?: Pick<MentorBotRecord, "name"> | null;
};

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function uploadImage(userId: string, file: File | null, kind: "avatar" | "banner") {
  if (!file) return null;
  if (!file.type.startsWith("image/")) throw new Error("Please select an image file.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Images must be 5 MB or smaller.");
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${crypto.randomUUID()}-${kind}.${ext}`;
  const { error } = await supabase.storage.from("mentor-bot-media").upload(path, file, {
    cacheControl: "3600", upsert: false, contentType: file.type,
  });
  throwIfError(error);
  return supabase.storage.from("mentor-bot-media").getPublicUrl(path).data.publicUrl;
}

export async function listMentorBots(mentorId: string): Promise<MentorBotRecord[]> {
  const { data, error } = await db.from("mentor_bots").select("*").eq("mentor_id", mentorId).order("created_at", { ascending: false });
  throwIfError(error);
  return data ?? [];
}

export async function saveMentorBot(input: {
  mentorId: string; name: string; mentorName: string; description: string; strategies: string;
  avatarFile: File | null; bannerFile: File | null;
}) {
  const [avatarUrl, backgroundUrl] = await Promise.all([
    uploadImage(input.mentorId, input.avatarFile, "avatar"),
    uploadImage(input.mentorId, input.bannerFile, "banner"),
  ]);
  const { data, error } = await db.from("mentor_bots").insert({
    mentor_id: input.mentorId,
    name: input.name.trim(),
    mentor_name: input.mentorName.trim(),
    description: input.description.trim(),
    strategies: input.strategies.trim(),
    avatar_url: avatarUrl,
    background_url: backgroundUrl,
  }).select("*").single();
  throwIfError(error);
  return data as MentorBotRecord;
}

export async function deleteMentorBot(botId: string) {
  const { error } = await db.from("mentor_bots").delete().eq("id", botId);
  throwIfError(error);
}

export async function listMentorLicenses(mentorId: string): Promise<MentorLicenseRecord[]> {
  const { data, error } = await db.from("mentor_bot_licenses")
    .select("id,license_key,client_name,client_email,bot_id,status,created_at,bot:mentor_bots(name)")
    .eq("mentor_id", mentorId).order("created_at", { ascending: false });
  throwIfError(error);
  return data ?? [];
}

export async function issueMentorLicense(input: {
  botId: string; clientName: string; clientEmail: string;
}) {
  const key = `EVX-${crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase()}`;
  const { error } = await db.rpc("issue_mentor_bot_license", {
    p_license_key: key,
    p_bot_id: input.botId,
    p_client_name: input.clientName.trim(),
    p_client_email: input.clientEmail.trim().toLowerCase(),
  });
  throwIfError(error);
  return key;
}

export async function redeemMentorLicense(licenseKey: string) {
  const { data, error } = await db.rpc("redeem_mentor_bot_license", {
    p_license_key: licenseKey.trim().toUpperCase(),
  });
  throwIfError(error);
  return data as { bot_id: string; bot_name: string; mentor_name: string };
}

export async function getMyAssignedMentorBot() {
  const { data, error } = await db.from("mentor_bot_licenses")
    .select("id,bot:mentor_bots(id,name,mentor_name,description,strategies,avatar_url,background_url)")
    .eq("client_id", (await supabase.auth.getUser()).data.user?.id)
    .eq("status", "redeemed").order("redeemed_at", { ascending: false }).limit(1).maybeSingle();
  throwIfError(error);
  return data?.bot ?? null;
}
