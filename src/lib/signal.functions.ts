import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FEED_INSTRUMENTS, FEED_TIMEFRAMES, HTF_OF, fetchBars } from "./marketdata";
import { isValidSetting, type Bar } from "./strategy";
import { backtest, buildSignal } from "./signals";

const SignalInput = z.object({
  instrument: z.enum(FEED_INSTRUMENTS as [string, ...string[]]),
  timeframe: z.enum(FEED_TIMEFRAMES as [string, ...string[]]),
  strategy: z.string().refine(isValidSetting, "Unknown strategy"),
});

/** Generates a forward-looking signal from REAL closed bars. Never fabricates prices:
 *  if the feed fails, is incomplete or stale, the caller gets the error and nothing is stored. */
export const generateSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SignalInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const res = await fetchBars(data.instrument, data.timeframe);
    if (!res.ok) return { ok: false as const, error: res.error };

    let htfBars: Bar[] | null = null;
    const htf = HTF_OF[data.timeframe];
    if (htf) {
      const h = await fetchBars(data.instrument, htf);
      if (h.ok) htfBars = h.bars;
    }

    const out = buildSignal(data.strategy, res.bars, htfBars, data.instrument, data.timeframe, res.digits, res.dataAt);
    if (!out.ok) return { ok: false as const, reason: out.reason };
    const s = out.signal;

    // Duplicate prevention: the same strategy on the same closed bar is stored once per user.
    const { data: existing } = await supabase
      .from("signals").select("id").eq("user_id", userId).eq("signal_key", s.key).maybeSingle();
    if (existing) return { ok: false as const, reason: "This signal was already generated for the latest closed bar. Wait for the next bar or change settings." };

    const { data: row, error } = await supabase
      .from("signals")
      .insert({
        user_id: userId,
        symbol: data.instrument,
        timeframe: data.timeframe,
        strategy: s.strategy,
        side: s.side,
        entry: s.entry,
        stop_loss: s.sl,
        take_profit: s.tp,
        risk_reward: s.rr,
        reason: s.reason,
        explanation: s.explanation,
        signal_key: s.key,
        status: "active",
        data_at: new Date(s.dataAt).toISOString(),
        expires_at: new Date(s.expiresAt).toISOString(),
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false as const, error: "Signal computed but could not be saved." };

    return { ok: true as const, id: row.id, signal: s, source: res.source };
  });

export const listSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("signals")
      .select("id, symbol, timeframe, strategy, side, entry, stop_loss, take_profit, risk_reward, reason, status, data_at, expires_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

/** Walk-forward backtest of a strategy on real historical bars. Stored in backtest_runs
 *  and always labelled as historical statistics, never a performance promise. */
export const runSignalBacktest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SignalInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const res = await fetchBars(data.instrument, data.timeframe);
    if (!res.ok) return { ok: false as const, error: res.error };

    const metrics = backtest(data.strategy, res.bars, data.instrument, data.timeframe, res.digits);
    const { rMultiples, ...summary } = metrics;
    await supabase.from("backtest_runs").insert({
      user_id: userId,
      symbol: data.instrument,
      timeframe: data.timeframe,
      strategy: data.strategy,
      bar_count: res.bars.length,
      first_bar: new Date(metrics.firstBar).toISOString(),
      last_bar: new Date(metrics.lastBar).toISOString(),
      metrics: { ...summary, rMultiples },
    });
    return { ok: true as const, metrics, barCount: res.bars.length, source: res.source };
  });
