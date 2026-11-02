import { describe, expect, it } from "vitest";
import { ChangeAccountInput, identityChanged } from "@/lib/accountChange";

const botId = "11111111-2222-4333-8444-555555555555";

describe("ChangeAccountInput", () => {
  it("accepts a normal MT5 login and server and trims them", () => {
    const r = ChangeAccountInput.parse({ botId, login: " 477620001 ", server: " Exness-MT5Real ", label: "  Main " });
    expect(r).toMatchObject({ login: "477620001", server: "Exness-MT5Real", label: "Main" });
  });
  it("turns an empty label into null", () => {
    expect(ChangeAccountInput.parse({ botId, login: "123456", server: "Broker-Live", label: "   " }).label).toBeNull();
  });
  it("rejects bad logins and servers", () => {
    expect(ChangeAccountInput.safeParse({ botId, login: "12", server: "Broker-Live" }).success).toBe(false);
    expect(ChangeAccountInput.safeParse({ botId, login: "12ab34", server: "Broker-Live" }).success).toBe(false);
    expect(ChangeAccountInput.safeParse({ botId, login: "123456", server: "x" }).success).toBe(false);
    expect(ChangeAccountInput.safeParse({ botId: "nope", login: "123456", server: "Broker-Live" }).success).toBe(false);
  });
});

describe("identityChanged", () => {
  const cur = { login: "123456", server: "Broker-Live" };
  it("is false when only the label would change", () => {
    expect(identityChanged(cur, { login: " 123456", server: "Broker-Live " })).toBe(false);
  });
  it("is true when the login or the server changes", () => {
    expect(identityChanged(cur, { login: "654321", server: "Broker-Live" })).toBe(true);
    expect(identityChanged(cur, { login: "123456", server: "Broker-Demo" })).toBe(true);
  });
});
