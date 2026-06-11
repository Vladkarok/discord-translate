# Decisions

Grep-able one-line index of durable decisions. Reasoning lives in the
linked session file or commit; this file is the index, not the
explanation.

Append-only. Newest at the bottom. To supersede an earlier decision,
add a new line that references the old one — never delete or rewrite a
prior entry.

Format:

```
YYYY-MM-DD · <one-line decision> · <sessions/file.md or commit SHA>
```

Examples:

```
2026-05-24 · Adopt cross-tool agent memory protocol v2.1 · docs/agent/sessions/2026-05-24-093000-claude-memory-bootstrap.md
2026-05-25 · Drop DECISIONS.md exclusion from CI paths-ignore (false positive earlier) · 7e4bf4b
2026-06-02 · Reverse 2026-05-24 — use protocol v2 (drop DECISIONS.md) · docs/agent/sessions/2026-06-02-110000-claude-prune.md
```

Read on demand (look up "when did we decide X?"), not loaded on every
`start session`.

---

<!-- Append real entries below this line. -->

2026-05-25 · Build v1 as a TypeScript Discord app using DeepL primary, optional Google fallback, SQLite quota/settings, and Docker Compose · docs/agent/sessions/2026-05-25-214703-codex-translation-plan.md
2026-05-25 · Defer Google Cloud Translation indefinitely; v1 ships DeepL-only (interface kept for later adapter) · docs/agent/sessions/2026-05-25-222358-claude-bootstrap-and-plan-refinement.md
2026-05-25 · Use better-sqlite3 with a startup CREATE TABLE IF NOT EXISTS migrator; no ORM in v1 · docs/agent/sessions/2026-05-25-222358-claude-bootstrap-and-plan-refinement.md
2026-05-25 · Cache stores translated text + source hash only by default (env opt-in CACHE_STORE_SOURCE_TEXT=true for source-text caching) · docs/agent/sessions/2026-05-25-222358-claude-bootstrap-and-plan-refinement.md
2026-05-25 · Quota check-and-increment is a single atomic SQL UPDATE with WHERE clause to avoid TOCTOU between concurrent interactions · docs/agent/sessions/2026-05-25-222358-claude-bootstrap-and-plan-refinement.md
2026-05-25 · Per-user daily char cap in addition to per-provider monthly cap (single friend cannot torch shared monthly budget) · docs/agent/sessions/2026-05-25-222358-claude-bootstrap-and-plan-refinement.md
2026-05-25 · Drop allowed_servers table; collapse to single users.server_usage_enabled boolean for v1 · docs/agent/sessions/2026-05-25-222358-claude-bootstrap-and-plan-refinement.md
2026-05-25 · Owner identity from OWNER_DISCORD_ID env only; not stored as DB row · docs/agent/sessions/2026-05-25-222358-claude-bootstrap-and-plan-refinement.md
2026-05-25 · Discord MessageContent intent stays disabled; message context commands deliver target message in the interaction payload · docs/agent/sessions/2026-05-25-222358-claude-bootstrap-and-plan-refinement.md
2026-05-25 · Container runs as non-root via Node official image's USER node · docs/agent/sessions/2026-05-25-222358-claude-bootstrap-and-plan-refinement.md
2026-05-26 · Reverse 2026-05-25 per-user daily cap decision — v1 uses provider monthly hard stop; optional per-user throttle only if real abuse appears · docs/agent/sessions/2026-05-26-174746-codex-plan-rationale.md
2026-05-27 · Switch translation provider from DeepL Free to Google Cloud Translation v2 (DeepL Free API signups closed; Google offers a recurring ~500K NMT chars/month free credit, not a 12-month trial). Provider interface unchanged. · docs/agent/sessions/2026-05-27-224000-claude-v1-complete.md
2026-05-28 · Deploy via GHCR + self-hosted runner labeled `disctrans` (Unix user `gh-disctrans` on kc-github-runner); matches youtube-download-bot/email-to-telegram/shiny pattern · docs/agent/sessions/2026-05-28-204630-claude-cicd-and-russian.md
2026-05-28 · VPS deploy key restricted by `from="IP"` + no-pty/no-fwd only (not forced-command); matches tg-audio-dl trust model · docs/agent/sessions/2026-05-28-204630-claude-cicd-and-russian.md
2026-05-28 · Deploy trigger = push to master + workflow_dispatch; no release-tag ritual for a personal bot · docs/agent/sessions/2026-05-28-204630-claude-cicd-and-russian.md
2026-05-28 · Russian added as supported source/target language (Google v2 accepts `ru` natively) · docs/agent/sessions/2026-05-28-204630-claude-cicd-and-russian.md
2026-06-11 · Dual-graph MCP removed from this repo — fixed per-session cost exceeds retrieval savings at 2.6k LOC; built-in Grep/Glob/Read preferred · docs/agent/sessions/2026-06-11-182111-claude-remove-dual-graph-mempalace.md
