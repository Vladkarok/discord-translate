# Task: Build the v1 Discord translation bot

**Status:** in progress
**Started:** 2026-05-25
**Completed:** —
**Active:** yes
**Slug:** discord-translation-bot

## Goal

Ship a personal Discord translation bot for the owner + 2 friends. Users
pick a message via `Apps -> Translate`, the bot replies ephemerally with
the translation, plus controls for source/target override and saving a
default target language. DeepL Free is the only translation provider in
v1; SQLite + Docker on a VPS. Hard local quota stop before any paid
usage.

Full product spec: `docs/plans/discord-translation-bot.md`.

## Plan

- [x] Step 0: Bootstrap repo + lock v1 plan
    - Customize identity files (AGENTS.md, CLAUDE.md, README).
    - Apply v1 deltas to the plan (drop M4 Google, drop Drizzle,
      drop allowed_servers table, drop owner-in-DB, hash-only cache
      default, atomic quota, no default per-user daily cap, non-root container,
      `MessageContent` intent off).
    - Remove template-package detritus from the repo tree.
    - Create this task file.
- [ ] Step 1 (M0): Project bootstrap
    - TypeScript package: `package.json`, `tsconfig.json`, `npm scripts`
      for typecheck/lint/format/test.
    - Dockerfile (Node official image, non-root `USER node`).
    - `docker-compose.yml` (single bot service + volume).
    - `.env.example` with all v1 variables (no real secrets anywhere).
    - Lint/format toolchain (eslint + prettier or biome — TBD).
    - Acceptance: `npm run typecheck` passes; `docker compose config` passes.
- [ ] Step 2 (M1): Discord skeleton + user-install verification
    - `discord.js` client startup with zero privileged intents.
    - Register `Translate` message context-menu command.
    - Idempotent registration runs on container start (skip via env).
    - Placeholder ephemeral handler: `interaction.deferReply({ flags:
      MessageFlags.Ephemeral })` then "Translation coming soon".
    - Owner-only `/settings show`.
    - **Verify on a throwaway Discord app** that user-install + message
      context menu actually appears in DMs (desktop + mobile). This is
      the gate before any provider work (self-review #2).
    - Acceptance: bot installable; `Apps -> Translate` visible in DM;
      unauthorized users get a private denial.
- [ ] Step 3 (M2): Database + access control
    - `better-sqlite3` setup; startup migrator with idempotent
      `CREATE TABLE IF NOT EXISTS`.
    - Tables: `users`, `provider_usage`, `translation_cache`
      (hash-only schema by default).
    - `/friends add/remove/list` (owner-only by `OWNER_DISCORD_ID`).
    - DM-only default for friends; `/access server enable/disable`.
    - Acceptance: owner adds a friend; friend translates in DM only;
      server denied by default; owner toggle works.
- [ ] Step 4 (M3): DeepL provider
    - `TranslationProvider` interface with sync `supports()`.
    - DeepL adapter against `api-free.deepl.com`.
    - Language map for en/fr/uk; auto-detect support.
    - Atomic provider-quota reservation: per-provider monthly UPDATE wrapped
      in one `db.transaction(...)`; 0 rows = reject before HTTP.
    - Asymmetric refund: refund only on pre-send / definitely-not-billed
      failures (validation, unsupported lang, 401/403, explicit
      pre-process 4xx). Keep reservation on timeouts and 5xx.
    - DeepL adapter owns exact language codes: internal `en/fr/uk/auto`,
      `source_lang` omitted for auto, manual source `EN/FR/UK`, target
      English defaults to `EN-US` unless configured to `EN-GB`.
    - Verify protected placeholders survive exactly once before rehydrating;
      otherwise return a private error or conservative fallback rendering.
    - Render `source -> target | provider | original preview | translation`
      in the ephemeral response.
    - Acceptance: uk→en, fr→en, en→fr all work; provider quota reserves
      atomically; over-quota call is rejected before HTTP; same-language
      known pairs are prompted before billing; timeouts/5xx do not refund.
- [ ] Step 5 (M4): Interactive source/target controls
    - `Source` / `Target` select menus.
    - `Swap` button (disabled when source is auto).
    - `Save target` button.
    - In-memory `Map<sessionId, TranslationSession>` with 15–30 min TTL
      and periodic sweep. `sessionId` embedded in component `custom_id`s
      (≤100 chars total). Session holds invoking user ID + protected
      source + current source/target.
    - Component handlers verify `interaction.user.id === session.userId`
      before acting; reject foreign interactions.
    - Acceptance: user can change source, target, swap, and save;
      another user cannot operate someone else's controls; expired
      session returns a clear ephemeral message.
- [ ] Step 6 (M5): Cache, polish, long messages
    - Translation cache (hash-only) with 30d retention.
    - `/quota status` (owner sees aggregate, friend sees own).
    - Discord-aware rendering: bot message `content` cap = 2000;
      embed `description` = 4096; total embed payload = 6000. Render
      to content=2000 by default; move translation body into an embed
      when it exceeds. No file attachments for output in v1.
    - Structured logs (no message content by default).
    - Acceptance: repeat translation hits cache; long messages
      don't error at Discord API layer.
- [ ] Step 7 (M6): VPS deployment
    - `docker compose up -d` on the VPS.
    - Persistent volume mount confirmed; restart policy verified.
    - Document Discord Developer Portal + DeepL Free setup in
      `docs/operations/` (created at this step).
    - Owner + 1 friend end-to-end DM smoke test.
    - Acceptance: bot survives container restart; SQLite persists;
      both users can install and use; server usage remains off unless
      enabled.

## Findings

### Step 0

Refined plan based on user answers:
- DeepL primary (clearer free metering, in-app quality preference).
- 3-user scale → strong YAGNI; dropped Drizzle, allowed_servers table,
  owner-in-DB, runtime provider selection, Google in v1.
- VPS ops not a concern → no architectural pivot to webhook-only.

Template-package files removed: BOOTSTRAP_PROMPT.md, INSTALL_FOR_CLAUDE.md,
docs/ARCHITECTURE.md, docs/meta/, EXAMPLE-*.template files. They were
copied during the initial Codex bootstrap but per INSTALL_FOR_CLAUDE.md
lines 121–137 they do not belong in the project tree.

## Decisions

- DeepL Free only in v1; Google deferred indefinitely (interface kept).
- `better-sqlite3` + startup `CREATE TABLE IF NOT EXISTS` migrator;
  no ORM.
- Hash-only cache by default; `CACHE_STORE_SOURCE_TEXT=true` env opt-in
  for source caching.
- Atomic SQL check-and-increment for provider quota (TOCTOU-safe).
- No default per-user daily cap; usage is bursty, so provider monthly quota is
  the v1 hard stop. Optional per-user throttle can be added later if real abuse
  appears.
- Owner identity is env-only (`OWNER_DISCORD_ID`); not stored in DB.
- Single `users.server_usage_enabled` boolean; no per-server allowlist
  table in v1.
- Container runs as non-root (`USER node`).
- Discord MessageContent intent stays OFF; not needed for message
  context commands.
- Bot message `content` cap is 2000 (not 4000); embed description 4096,
  total embed 6000. Renderer designed around content=2000 with embed as
  the long-form path. No file attachments for output in v1 (Discord CDN
  URLs are publicly reachable).
- Component interactive state (Source/Target/Swap/Save) lives in an
  in-memory `Map<sessionId, TranslationSession>` with 15–30 min TTL.
  Promoted to a SQLite `translation_sessions` table only if container
  restarts mid-conversation become a real problem. Keeps no-source-text-
  on-disk discipline intact.
- Provider quota reserved in one `db.transaction(...)`. Refund asymmetric:
  only on definitely-not-billed failures; keep reservation on timeout/5xx
  ambiguity.
- Google deferral rationale corrected: the ~500K NMT chars/month free is
  a recurring monthly credit, not a 12-month trial. Defer reason is GCP
  setup overhead, not free-tier expiry.

## Current edge

Step 0 / plan refinement is complete. The canonical plan now has the useful
deep-research refinements folded in: Discord `USER_INSTALL`/`PRIVATE_CHANNEL`
verification, edit-original ephemeral response rule, formatting protection,
placeholder integrity checks, DeepL language mapping, refund-only-when-
definitely-unbilled quota semantics, no default per-user daily cap, rationale
comments, and V1.x/V2 evolution boundaries.

Next agent should pick up at **Step 1 (M0)**: scaffold the TypeScript
package, Dockerfile, and Compose file. Before writing any Discord
client code, verify on a throwaway app that the user-install +
message-context-menu UX actually works in DMs (self-review #2 in the
plan).

## Open questions

- Lint/format choice for the TS package: ESLint + Prettier (industry
  default, more config) vs. Biome (single fast tool, less mature).
  Pick at Step 1.
- Use `pnpm` vs `npm`? Personal scale → either works. Default to npm
  unless reason emerges.
- Group DM behaviour: treat as DM, or disable until tested? Decide
  during Step 2 manual verification.
- Keep, delete, or ignore `docs/plans/deep-research-report.md`? It was used
  as advisory input and is still untracked.
