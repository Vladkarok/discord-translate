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
      default, atomic quota, per-user daily cap, non-root container,
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
    - Tables: `users`, `user_daily_usage`, `provider_usage`,
      `translation_cache` (hash-only schema by default).
    - `/friends add/remove/list` (owner-only by `OWNER_DISCORD_ID`).
    - DM-only default for friends; `/access server enable/disable`.
    - Acceptance: owner adds a friend; friend translates in DM only;
      server denied by default; owner toggle works.
- [ ] Step 4 (M3): DeepL provider
    - `TranslationProvider` interface with sync `supports()`.
    - DeepL adapter against `api-free.deepl.com`.
    - Language map for en/fr/uk; auto-detect support.
    - Atomic quota check-and-increment SQL (one UPDATE with WHERE
      clause; 0 rows = reject).
    - Per-user daily cap check (same atomic pattern on `user_daily_usage`).
    - Render `source -> target | provider | original preview | translation`
      in the ephemeral response.
    - Acceptance: uk→en, fr→en, en→fr all work; quota increments
      atomically; over-quota call is rejected before HTTP.
- [ ] Step 5 (M4): Interactive source/target controls
    - `Source` / `Target` select menus.
    - `Swap` button (disabled when source is auto).
    - `Save target` button.
    - Component custom IDs include invoking user ID; reject foreign
      interactions.
    - Acceptance: user can change source, target, swap, and save.
- [ ] Step 6 (M5): Cache, polish, long messages
    - Translation cache (hash-only) with 30d retention.
    - `/quota status` (owner sees aggregate, friend sees own).
    - Discord-aware truncation rules (4000-char message cap,
      2000-char ephemeral body cap).
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
- Per-user daily char cap in addition to provider monthly cap.
- Owner identity is env-only (`OWNER_DISCORD_ID`); not stored in DB.
- Single `users.server_usage_enabled` boolean; no per-server allowlist
  table in v1.
- Container runs as non-root (`USER node`).
- Discord MessageContent intent stays OFF; not needed for message
  context commands.

## Current edge

Step 0 nearly complete: identity files customized, README replaced,
plan updated in-place, template files removed, this task file
created. Pending: STATE.md update, session file creation, JOURNAL
and DECISIONS entries, two-commit local commit (project + agent).

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
