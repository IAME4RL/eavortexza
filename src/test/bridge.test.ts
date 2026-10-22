import { describe, expect, it } from "vitest";
import { deliverySlots, formatSignalLine, holdReason, reportTransition, volumeAllowed } from "@/lib/bridge";

describe("MT5 queued-order bridge", () => {
  const input = { status: "running" as const, demoOnly: true, terminalIsDemo: true, terminalLogin: "12345", accountLogin: "12345", openTrades: 0, maxOpenTrades: 3 };
  it("holds orders when the registered account login differs", () => {
    expect(holdReason({ ...input, terminalLogin: "99999" })).toBe("LOGIN_MISMATCH");
  });
  it("holds live accounts when demo-only is enabled", () => {
    expect(holdReason({ ...input, terminalIsDemo: false })).toBe("DEMO_ONLY");
  });
  it("holds paused orders", () => { expect(holdReason({ ...input, status: "paused" })).toBe("PAUSED"); });
  it("holds stopped orders", () => { expect(holdReason({ ...input, status: "stopped" })).toBe("STOPPED"); });
  it("holds at the configured open-position limit", () => {
    expect(holdReason({ ...input, openTrades: 3 })).toBe("MAX_OPEN");
    expect(deliverySlots(3, 3)).toBe(0);
    expect(deliverySlots(1, 3)).toBe(2);
  });
  it("permits matching running demo terminals below the limit", () => { expect(holdReason(input)).toBeNull(); });
  it("rejects nonpositive or oversized volumes", () => {
    expect(volumeAllowed(0, 0.1)).toBe(false);
    expect(volumeAllowed(0.11, 0.1)).toBe(false);
    expect(volumeAllowed(0.1, 0.1)).toBe(true);
  });
  it("formats the seven-field MT5 protocol without guessing symbol aliases", () => {
    expect(formatSignalLine({ id: "123", symbol: "XAUUSD.m", side: "buy", volume: 0.01, stop_loss: null, take_profit: 2500 }))
      .toBe("SIG|123|XAUUSD.m|buy|0.01|0|2500");
  });
  it("accepts broker fills only for delivered orders", () => {
    expect(reportTransition("sent", "filled")).toBe("apply");
    expect(reportTransition("queued", "filled")).toBe("reject");
    expect(reportTransition("cancelled", "filled")).toBe("reject");
  });
  it("acknowledges repeated fills without applying another notification", () => {
    expect(reportTransition("filled", "filled")).toBe("ack");
    expect(reportTransition("closed", "filled")).toBe("ack");
  });
  it("accepts closure only after fill and acknowledges repeated closure", () => {
    expect(reportTransition("filled", "closed")).toBe("apply");
    expect(reportTransition("closed", "closed")).toBe("ack");
    expect(reportTransition("sent", "closed")).toBe("reject");
  });
  it("does not overwrite a fill with a rejection", () => {
    expect(reportTransition("sent", "rejected")).toBe("apply");
    expect(reportTransition("rejected", "rejected")).toBe("ack");
    expect(reportTransition("filled", "rejected")).toBe("reject");
  });
});