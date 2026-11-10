import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudError, accountSummary, checkConnect, getQuote, orderSend, positions, registerAccount, scrub } from "@/lib/api2trade";

const calls: { url: string; init: RequestInit }[] = [];
function mockFetch(respond: (url: string, init: RequestInit) => { status?: number; body: unknown }) {
  vi.stubGlobal("fetch", vi.fn(async (u: URL | string, init: RequestInit = {}) => {
    const url = String(u); calls.push({ url, init });
    const r = respond(url, init);
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status ?? 200 });
  }));
}
const KEY = "test-key";
beforeEach(() => { calls.length = 0; delete process.env["API2TRADE_BASE_URL"]; });
afterEach(() => { vi.unstubAllGlobals(); });

describe("api2trade client", () => {
  it("registers an account with the key header and returns only the id", async () => {
    mockFetch(() => ({ body: { id: "11111111-2222-3333-4444-555555555555" } }));
    const r = await registerAccount(KEY, { login: "123456", password: "S3cret!", server: "Broker-Live" });
    expect(r).toEqual({ id: "11111111-2222-3333-4444-555555555555" });
    expect(calls[0]!.url).toBe("https://api.metatraderapi.dev/RegisterAccount");
    expect((calls[0]!.init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
  });
  it("never echoes the broker password in an error", async () => {
    mockFetch(() => ({ status: 400, body: { message: "Invalid login: bad password S3cret! for 123456" } }));
    const err = await registerAccount(KEY, { login: "123456", password: "S3cret!", server: "Broker-Live" }).catch((e) => e as CloudError);
    expect(err).toBeInstanceOf(CloudError);
    expect((err as CloudError).message).not.toContain("S3cret!");
    expect((err as CloudError).message).toContain("***");
  });
  it("fails clearly when the client has not saved an API key", async () => {
    await expect(getQuote("", "id", "EURUSD")).rejects.toMatchObject({ code: "not_configured" });
  });
  it("sends each client's own key, never a shared one", async () => {
    mockFetch(() => ({ body: { bid: 1, ask: 1.1 } }));
    await getQuote("client-A-key", "id", "EURUSD");
    await getQuote("client-B-key", "id", "EURUSD");
    expect((calls[0]!.init.headers as Record<string, string>)["x-api-key"]).toBe("client-A-key");
    expect((calls[1]!.init.headers as Record<string, string>)["x-api-key"]).toBe("client-B-key");
  });
  it("reports a rejected key clearly and never leaks it", async () => {
    mockFetch(() => ({ status: 401, body: { message: "bad key client-A-key" } }));
    const err = await getQuote("client-A-key", "id", "EURUSD").catch((e) => e as CloudError);
    expect(err).toMatchObject({ code: "bad_key" });
    expect((err as CloudError).message).not.toContain("client-A-key");
    // a rejected key must surface (not look like "disconnected") so the engine can warn the client
    await expect(checkConnect("client-A-key", "id")).rejects.toMatchObject({ code: "bad_key" });
  });
  it("sends buy as operation 0 and sell as 1, and reads ticket/retcode", async () => {
    mockFetch(() => ({ body: { ticket: 987, retcode: 0, price: 2330.4 } }));
    const ok = await orderSend(KEY, "acc", { symbol: "XAUUSD", side: "buy", volume: 0.02, stopLoss: 2320, takeProfit: 2350 });
    expect(ok).toEqual({ ok: true, ticket: "987", price: 2330.4, error: null });
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ symbol: "XAUUSD", operation: 0, volume: 0.02, stopLoss: 2320, takeProfit: 2350 });
    await orderSend(KEY, "acc", { symbol: "XAUUSD", side: "sell", volume: 0.02, stopLoss: 2340, takeProfit: 2310 });
    expect(JSON.parse(String(calls[1]!.init.body)).operation).toBe(1);
    expect(calls[1]!.url).toContain("id=acc");
  });
  it("treats a non-zero retcode or missing ticket as a rejection", async () => {
    mockFetch(() => ({ body: { ticket: 0, retcode: 10019, comment: "No money" } }));
    const r = await orderSend(KEY, "acc", { symbol: "EURUSD", side: "buy", volume: 1, stopLoss: 1, takeProfit: 2 });
    expect(r.ok).toBe(false);
    expect(r.ticket).toBeNull();
    expect(r.error).toBe("No money");
  });
  it("rejects invalid quotes and summaries", async () => {
    mockFetch(() => ({ body: { bid: 0, ask: 0 } }));
    await expect(getQuote(KEY, "id", "FAKE")).rejects.toMatchObject({ code: "bad_quote" });
    mockFetch(() => ({ body: {} }));
    await expect(accountSummary(KEY, "id")).rejects.toMatchObject({ code: "bad_response" });
  });
  it("normalises positions and connection checks", async () => {
    mockFetch((url) => url.includes("/Positions")
      ? { body: [{ ticket: 5, symbol: "XAUUSD", type: "Buy", volume: 0.02, openPrice: 2330, profit: 3.5 }, { symbol: "bad" }] }
      : { body: { connected: false } });
    const p = await positions(KEY, "id");
    expect(p).toEqual([{ ticket: "5", symbol: "XAUUSD", side: "buy", volume: 0.02, price: 2330, profit: 3.5 }]);
    expect(await checkConnect(KEY, "id")).toBe(false);
  });
  it("scrub hides secrets and truncates", () => {
    expect(scrub("pw=abc123 ok", ["abc123"])).toBe("pw=*** ok");
    expect(scrub("x".repeat(500)).length).toBe(200);
  });
});
