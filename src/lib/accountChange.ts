import { z } from "zod";

/** Input for switching the MT5 account a bot is attached to (shared by the form and the server). */
export const ChangeAccountInput = z.object({
  botId: z.string().uuid(),
  login: z.string().trim().regex(/^\d{3,12}$/, "MT5 login must be 3–12 digits"),
  server: z.string().trim().min(2, "Enter the exact broker server name").max(80, "Server name is too long"),
  label: z.string().trim().max(60, "Label is too long").optional().transform((v) => (v ? v : null)),
});
/** The fields the user types (the form validates these; the server also checks the bot id). */
export const ChangeAccountFields = ChangeAccountInput.omit({ botId: true });
export type ChangeAccountData = z.infer<typeof ChangeAccountInput>;

/** True when the MT5 account itself changes (login or server), not only its label. */
export function identityChanged(current: { login: string; server: string }, next: { login: string; server: string }): boolean {
  return current.login.trim() !== next.login.trim() || current.server.trim() !== next.server.trim();
}
