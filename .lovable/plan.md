# EA VORTEX — Separate Mentor and Client Portals

## Inspection findings
- Existing authentication, profiles, mentor approvals, client assignments, scanner, strategy engine, trading accounts, START/STOP controls, and MT5 Bridge will be preserved.
- The engine currently implements 15 rule-based strategies. Robot building will configure those implementations, not advertise new or unimplemented strategies.
- Mentor-owned robot templates, licenses, activation history, and a separate mentor dashboard do not currently exist.
- The START validator currently accepts fewer strategies than the engine implements; align it with the existing registry.
- Original video and screenshot files are not available in this workspace. Use the earlier descriptions and existing EA VORTEX branding initially; exact visual matching requires reuploaded references.

## 1. Separate mentor access
- Add `/mentor/login` using existing authentication and profiles, without charging for accounts.
- Reuse administrator-approved mentor roles; requesting access never grants privileges automatically.
- Add `/mentor/dashboard`, `/mentor/bots`, `/mentor/keys`, `/mentor/clients`, `/mentor/strategies`, and `/mentor/marketplace` under the existing protected routing structure.
- Enforce mentor roles before rendering and inside every protected management operation. Ordinary clients cannot access these pages by typing their URLs.
- Preserve `/dashboard/mentor` as a link or redirect to the new portal.

## 2. Mentor robot builder
- Create mentor-owned configurations with name, description, implemented strategy selection, instruments, timeframes, lot limits, open-position limits, risk percentage, and daily loss limit.
- Support creation, editing, enabling/disabling, archiving, marketplace availability, and client assignments.
- Show configuration availability separately from execution: an enabled template is not a running bot.
- Use the existing strategy engine and bridge for execution. Selected strategy sets must restrict automatic selection to those strategies, still producing at most one eligible setup or NO TRADE.
- Enforce allowed instruments/timeframes on terminal-reported data and outgoing orders, including GOLD/XAUUSD normalization without guessing broker symbol suffixes.

## 3. Licenses and clients
- Generate unique, cryptographically random license keys on the backend. Store a hash for validation; display a newly generated key once for copying and sharing.
- Let mentors select a robot, optional assigned client, expiry date, and activation limit.
- Show unused, active, expired, suspended, and revoked states from real records. Provide suspension, revocation, renewal, client identity, and activation timestamps.
- Validate activation atomically so simultaneous requests cannot exceed activation limits. Repeated activation by the same client is idempotent.
- Give each approved mentor a unique shareable mentor code. Let clients join using that code during onboarding or activation.
- Reuse existing mentor/client relationships where appropriate. Invitations are shareable links/codes; do not claim email delivery unless an email integration is added.
- Mentors view only their clients and the execution information required to manage assigned robots—not bridge tokens or unrelated account data.

## 4. Client trading portal
- Keep `/dashboard` as the client portal and `/dashboard/auto-trade` as the existing execution workspace.
- Add license activation and authorized robot selection, with license state/expiry and assigned mentor visible.
- Connect selected mentor configurations to the client's own existing MT5 bot/account. Clients cannot overwrite mentor-controlled settings.
- START and STOP continue calling the existing genuine backend controls. Check entitlement at START and every bridge poll; expired/revoked/suspended access blocks new execution, not just the page.
- STOP remains available even after license expiry. Preserve existing explicit live confirmation, risk checks, emergency close, terminal acknowledgements, and execution history.
- Existing standalone bots remain usable; mentor-managed bots cannot remove their license linkage or bypass configuration restrictions.
- Distinguish backend running permission, terminal online status, terminal acknowledgement, and actual reported fills. Explain offline or invalid-license blockers without claiming unverified trading.

## 5. Appearance
- Retain EA VORTEX's dark surfaces, red accents, typography, logo, and existing animations.
- Refine the client trading workspace with compact status summaries, prominent START BOT / STOP BOT controls, robot/account selectors, and terminal-reported history.
- Give mentors a separate management-focused shell: Overview, Bots, Keys, Clients, Strategies, Marketplace; mentor-code copy control and real license/robot statistics.
- Preserve AI Chart Scanner and Market Signals as separate client features. No fabricated charts, profit statistics, or guaranteed signals.
- Verify Android-sized and desktop layouts, navigation, readable controls, and reduced-motion behavior.

## Technical approach
- Add backward-compatible public tables for mentor codes, robot templates, robot assignments, licenses, and activation history; reuse `profiles`, `user_roles`, `mentor_assignments`, `trading_accounts`, `bots`, and `trade_signals`.
- Include explicit grants and owner-scoped row-level policies for every new table. Keep role decisions server-validated and license hashes inaccessible to ordinary browser reads.
- Use authenticated TanStack server functions for management and activation; use database functions/transactions for activation limits and ownership-sensitive operations.
- Add nullable managed-robot linkage to existing bots, with database enforcement preventing client tampering. Gate bridge order generation/delivery using the linked robot and license while preserving the pipe-delimited protocol and journal safety.
- Preserve generated integration files and existing public URLs. Give every content page its own app-specific metadata.

## Verification and limits
- Add concrete tests for owner isolation, mentor/client roles, activation limits, expiry boundaries, suspension/revocation, configuration restrictions, and continued legacy-bot behavior; run existing bridge, strategy, signal, and routing tests.
- Exercise mentor robot creation → key generation → client activation → robot selection → real START blocker/STOP response through the app using authorized sessions.
- Test direct unauthorized page and operation access, not only hidden navigation.
- Actual broker fills, Windows compilation, and continuous terminal execution require a connected MT5 terminal; report these as unverified unless that connection is available.
- Do not publish or rebuild the APK without a separate request; website changes will reach the existing wrapper after publication.