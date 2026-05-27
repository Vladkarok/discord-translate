# Journal

Append-only chronology of meaningful completed work and decisions.
Newest at the bottom. One entry per `save session`. Read by tail or by
searching for a slug — not loaded whole every session.

Durable decisions are also indexed one-line in `docs/agent/DECISIONS.md`.
That file is the lookup; this file is the narrative.

---

<!--
Entry format:

## YYYY-MM-DD HH:MM <tool> <slug>
- <one-line accomplishment>
- <key decision if any>
- see: docs/agent/sessions/<file>.md
-->

## 2026-05-25 21:47 codex translation-plan

- Created a detailed implementation plan for the Discord translation bot and recorded the fresh-repo state.
- Decided v1 should use DeepL primary, optional Google fallback, native Discord user install, and owner-managed allowlist/quota controls.
- see: docs/agent/sessions/2026-05-25-214703-codex-translation-plan.md

## 2026-05-25 22:24 claude bootstrap-and-plan-refinement

- Bootstrapped project chrome: customized AGENTS.md, README.md replaced with project README, identity files verified.
- Removed template-package detritus (BOOTSTRAP_PROMPT.md, INSTALL_FOR_CLAUDE.md, docs/ARCHITECTURE.md, docs/meta/, EXAMPLE-*.template) that does not belong in the project tree.
- Refined v1 plan for 3-user personal scale: DeepL-only (Google deferred), better-sqlite3 (no ORM), hash-only cache default, atomic quota check-and-increment, per-user daily cap, dropped allowed_servers table, dropped owner-in-DB, dropped MessageContent intent, container runs non-root.
- Created multi-session task file `docs/agent/tasks/discord-translation-bot.md` (Active: yes) mirroring revised milestones M0-M6 as checkboxes.
- see: docs/agent/sessions/2026-05-25-222358-claude-bootstrap-and-plan-refinement.md

## 2026-05-26 17:47 codex plan-rationale

- Folded useful deep-research findings into the canonical implementation plan and added rationale comments for major decisions.
- Reversed default per-user daily cap: v1 now uses provider monthly quota as the hard stop; optional per-user throttle is deferred until real abuse/noise appears.
- Added DeepL mapping, placeholder integrity, refund-only-when-definitely-unbilled quota semantics, and V1/V2 evolution boundaries.
- see: docs/agent/sessions/2026-05-26-174746-codex-plan-rationale.md

## 2026-05-27 22:40 claude v1-complete

- Shipped M0–M6 in one multi-turn session: TS package + Docker, discord.js client, SQLite + access control, Google Cloud Translation v2 adapter (pivoted from DeepL mid-build), interactive collapsible panel + session store, hash-only cache + /quota status + embed promotion, and deploy docs + backup scripts.
- Manually verified M1–M5 against the user's live Discord client and GCP Translation API. Final commit: `9fb0050 docs: deployment + ops walk-throughs and SQLite backup scripts (M6)`.
- Marked active task `discord-translation-bot` completed (Active: no). The bot is feature-complete and documented; nothing pushed yet.
- see: docs/agent/sessions/2026-05-27-224000-claude-v1-complete.md
