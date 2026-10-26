import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { INSTRUMENTS, TIMEFRAMES, STYLES, timeframeLabel, styleLabel, isGold } from "./instruments";

const MODEL = "openai/gpt-6-astra";

const ScanInput = z.object({
  imagePath: z.string().min(3).max(300),
  mimeType: z.enum(["image/png", "image/jpeg", "image/jpg"]),
  instrument: z.enum(INSTRUMENTS),
  timeframe: z.enum(TIMEFRAMES.map((t) => t.value) as [string, ...string[]]),
  style: z.enum(STYLES.map((s) => s.value) as [string, ...string[]]),
});

const SYSTEM = `You are EA VORTEX, a careful professional technical analyst reviewing a trading chart screenshot.
Rules:
- Analyse ONLY what is visible in the image. Never invent indicators, prices or levels that are not visible.
- If price axis labels are not legible, describe zones relatively (e.g. "the recent swing high") instead of exact prices.
- You have NO access to live or current market prices. Never claim to.
- Any trade setup is a HYPOTHETICAL scenario, never a recommendation. Never guarantee outcomes.
- If the image is not a trading chart or is unreadable, set image_quality to "unreadable", explain in limitations, and keep other fields brief.
- Report the instrument symbol visibly printed on the chart in symbol_detected (exact text), or null if none is visible.
Respond with ONLY a JSON object (no markdown) with exactly these keys:
{
 "symbol_detected": string|null,
 "image_quality": "good"|"limited"|"unreadable",
 "limitations": string,
 "bias": "bullish"|"bearish"|"neutral"|"mixed",
 "market_overview": string,
 "trend": { "direction": "uptrend"|"downtrend"|"range"|"unclear", "structure": string },
 "support_zones": string[],
 "resistance_zones": string[],
 "candlestick_patterns": string[],
 "chart_patterns": [{ "name": string, "significance": string }],
 "breakouts": string,
 "reversal_areas": string,
 "indicators_visible": string[],
 "bullish_scenario": string,
 "bearish_scenario": string,
 "trade_setup": { "available": boolean, "direction": "long"|"short"|"none", "entry_area": string, "invalidation": string, "targets": string[], "risk_reward": string },
 "risk_analysis": string,
 "uncertainties": string[],
 "summary": string
}`;

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI response did not contain an analysis");
  return JSON.parse(text.slice(start, end + 1));
}

export const runScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScanInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.imagePath.startsWith(`${userId}/`)) return { ok: false as const, error: "Invalid upload path." };

    const { data: settings } = await supabase.from("app_settings").select("*").eq("id", 1).single();
    if (settings && !settings.scanner_enabled) return { ok: false as const, error: "The scanner is temporarily disabled by the administrator." };
    const limit = settings?.daily_scan_limit ?? 5;
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase.from("scans").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("status", "completed").gte("created_at", since.toISOString());
    if ((count ?? 0) >= limit) return { ok: false as const, error: `You've used all ${limit} free scans for today. Your allowance resets at 00:00 UTC.` };

    const apiKey = process.env["LOVABLE_API_KEY"];
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey && !geminiKey && !process.env["OPENAI_API_KEY"]) return { ok: false as const, error: "AI service is not configured." };

    const { data: file, error: dlErr } = await supabase.storage.from("charts").download(data.imagePath);
    if (dlErr || !file) return { ok: false as const, error: "Could not read the uploaded chart." };
    if (file.size > 8 * 1024 * 1024) return { ok: false as const, error: "Image is larger than 8 MB." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Verify magic bytes: PNG or JPEG
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!isPng && !isJpg) return { ok: false as const, error: "File is not a valid PNG or JPEG image." };
    const base64 = Buffer.from(bytes).toString("base64");
    const mediaType = isPng ? "image/png" : "image/jpeg";

    const goldNote = isGold(data.instrument)
      ? "The user selected GOLD (XAUUSD). Treat GOLD, XAUUSD, XAU/USD, GOLDUSD and broker-suffixed variants (e.g. XAUUSD.m) as the same instrument. Consider gold's typically larger intraday ranges when discussing volatility, based only on visible candles."
      : "";
    const userText = `Instrument selected: ${data.instrument}. Timeframe: ${timeframeLabel(data.timeframe)}. Trading style: ${styleLabel(data.style)}. ${goldNote}
Analyse this chart for: market structure, trend, support/resistance zones, candlestick patterns, chart patterns, breakouts and possible false breakouts, reversal areas, bullish and bearish scenarios, visible indicators only, potential entry areas (only if supported), invalidation levels, target zones, risk-to-reward considerations and important uncertainties. Tailor the perspective to the trading style.`;

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const openaiKey = process.env["OPENAI_API_KEY"];
    const openai = openaiKey
      ? createOpenAI({ apiKey: openaiKey })
      : createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: apiKey ?? "",
          headers: { "Lovable-API-Key": apiKey ?? "", "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });

    let analysis: unknown;
    try {
      let text = "";
      if (geminiKey) {
        const res = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM }] },
              contents: [{ role: "user", parts: [
                { text: userText },
                { inlineData: { mimeType: mediaType, data: base64 } },
              ] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
          },
        );
        if (!res.ok) {
          const body = await res.text();
          throw Object.assign(new Error(res.status === 429 ? "rate limited" : `Gemini error ${res.status}: ${body.slice(0, 200)}`), { statusCode: res.status });
        }
        const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      } else {
      const result = streamText({
        model: openaiKey ? openai.chat("gpt-4o") : openai.responses(MODEL),
        maxRetries: 0,
        system: SYSTEM,
        messages: [{ role: "user", content: [
          { type: "text", text: userText },
          { type: "image", image: base64, mediaType },
        ] }],
        ...(openaiKey ? {} : { providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        } }),
      });
      let streamErr: unknown = null;
      for await (const part of result.fullStream) {
        if (part.type === "text-delta") text += part.text;
        if (part.type === "error") streamErr = part.error;
      }
      if (streamErr) throw streamErr;
      }
      if (!text.trim()) throw new Error("The AI service returned an empty response (it may have declined the request).");
      analysis = extractJson(text);
    } catch (err) {
      const e = err as { statusCode?: number; message?: string };
      const msg =
        (e.statusCode === 402 || /quota|credits/i.test(e.message ?? "")) ? "The AI scanner account is out of credit. Please contact the administrator."
        : e.statusCode === 429 ? "The AI service is busy. Please wait a moment and retry."
        : e.statusCode === 403 ? "The AI service refused this request."
        : e.message ?? "AI analysis failed.";
      console.error("scan failed", e.statusCode, e.message);
      await supabase.from("scans").insert({
        user_id: userId, instrument: data.instrument, timeframe: data.timeframe, trading_style: data.style,
        image_path: data.imagePath, status: "failed", error: msg,
      });
      return { ok: false as const, error: msg, retryable: e.statusCode === 429 || (e.statusCode ?? 500) >= 500 };
    }

    const { data: row, error: insErr } = await supabase.from("scans").insert({
      user_id: userId, instrument: data.instrument, timeframe: data.timeframe, trading_style: data.style,
      image_path: data.imagePath, status: "completed", analysis: analysis as never,
    }).select("id").single();
    if (insErr || !row) return { ok: false as const, error: "Analysis completed but could not be saved." };
    return { ok: true as const, id: row.id };
  });

export const getScanQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: settings } = await supabase.from("app_settings").select("*").eq("id", 1).single();
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase.from("scans").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("status", "completed").gte("created_at", since.toISOString());
    const limit = settings?.daily_scan_limit ?? 5;
    return { limit, used: count ?? 0, enabled: settings?.scanner_enabled ?? true, aiConfigured: !!(process.env["OPENAI_API_KEY"] || process.env["LOVABLE_API_KEY"]) };
  });
