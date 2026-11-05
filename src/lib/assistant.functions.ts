import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const AssistantInput = z.object({
  messages: z.array(MessageSchema).min(1).max(30),
});

const SYSTEM_PROMPT = `You are VORTEX AI, the advanced trading and market intelligence assistant inside the EA VORTEX platform.

Your capabilities and personality:
1. TRADING EXPERTISE: You specialize in GOLD (XAUUSD), major forex pairs (EURUSD, GBPUSD, USDJPY), US indices (NAS100, US30), and crypto (BTCUSD).
2. STRATEGIES: You understand Smart Money Concepts (SMC), Order Blocks, Liquidity Sweeps, Fair Value Gaps (FVG), Break of Structure (BOS), Change of Character (CHoCH), and classic Price Action.
3. RISK MANAGEMENT: Always emphasize strict risk management (1% to 2% max risk per trade, Stop-Loss placement, daily loss limits).
4. LOT SIZE CALCULATOR: When asked about lot sizes, calculate it directly:
   - Formula: (Account Balance * Risk %) / (Stop Loss pips * Pip Value)
   - For GOLD (XAUUSD): 0.01 lot = $0.10 per 10-cent move (or $1 per $1.00 price move).
5. NEWS & FUNDAMENTALS: Explain economic releases (NFP, CPI, Interest Rates, FOMC) and how currency strength affects Gold and Forex.
6. PLATFORM GUIDANCE: You know EA VORTEX features: the AI Chart Scanner, Auto Trade engine, News Signals calendar, and the MT5 Bridge connector.
7. TONE: Professional, concise, disciplined, and empowering. Use bullet points and bold levels for readability. Never guarantee profits or financial advice.`;

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AssistantInput.parse(d))
  .handler(async ({ data }) => {
    const geminiKey = process.env["GEMINI_API_KEY"];
    const openaiKey = process.env["OPENAI_API_KEY"];
    const lovableKey = process.env["LOVABLE_API_KEY"];

    if (!geminiKey && !openaiKey && !lovableKey) {
      return {
        ok: false as const,
        error: "AI service key is not configured. Please add GEMINI_API_KEY to your project secrets.",
      };
    }

    // Format conversation history
    const contents = data.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Method 1: Google Gemini (uses your configured free Gemini key)
    if (geminiKey) {
      const models = ["gemini-flash-lite-latest", "gemini-3.1-flash-lite", "gemini-3.5-flash"];
      for (const m of models) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents,
                generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
              }),
            }
          );

          if (res.ok) {
            const json = (await res.json()) as {
              candidates?: { content?: { parts?: { text?: string }[] } }[];
            };
            const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
            if (text.trim()) {
              return { ok: true as const, reply: text };
            }
          }
        } catch {
          // Try next fallback model
        }
      }
    }

    // Method 2: OpenAI / Lovable AI fallback
    try {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const { generateText } = await import("ai");
      const openai = openaiKey
        ? createOpenAI({ apiKey: openaiKey })
        : createOpenAI({
            baseURL: "https://ai.gateway.lovable.dev/v1",
            apiKey: lovableKey ?? "",
            headers: { "Lovable-API-Key": lovableKey ?? "" },
          });

      const result = await generateText({
        model: openaiKey ? openai.chat("gpt-4o-mini") : openai.chat("google/gemini-2.5-flash"),
        system: SYSTEM_PROMPT,
        messages: data.messages,
      });

      return { ok: true as const, reply: result.text };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "AI assistant is temporarily busy. Try again.",
      };
    }
  });
