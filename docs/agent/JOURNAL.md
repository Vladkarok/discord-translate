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
