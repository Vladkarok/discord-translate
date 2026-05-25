# Session 2026-05-25 22:23:58 — Claude Code — bootstrap-and-plan-refinement

**Tool:** Claude Code
**Started from session:** docs/agent/sessions/2026-05-25-214703-codex-translation-plan.md
**Branch:** master
**Code worktree:** dirty
**Tracked dirty code paths:** none
**Relevant untracked code paths:** none after this save — bootstrap commits stage everything intentional
**Active task:** discord-translation-bot

## Done

- Ran `start session` per `docs/agent/PROTOCOL.md`. Drift-check showed a fresh
  repo with one prior memory-only commit and ~15 untracked bootstrap/template
  files; correctly ignored the injected ECC `SessionStart` summary (it was
  from a different project, `email-to-telegram-internal`) per `CLAUDE.md`.
- Reviewed `docs/plans/discord-translation-bot.md` from multiple angles
  (over-engineering risk, quota correctness, Discord platform specifics,
  alternative architectures, operational gaps, privacy, multi-session
  bookkeeping). Surfaced concrete deltas for v1.
- User confirmed:
  - DeepL primary, in-app quality preference + clearer free metering.
  - 3-user audience (owner + 2 friends).
  - VPS Docker confirmed; ops not a concern.
  - Two-commit bootstrap split (project + agent).
- Applied v1 deltas to the plan in-place:
  - Dropped Google adapter / M4 from v1 (interface kept).
  - Dropped Drizzle; locked in `better-sqlite3` + startup migrator.
  - Dropped `allowed_servers` table.
  - Dropped owner-stored-in-DB.
  - Dropped `preferProvider`; made `supports()` sync.
  - Defaulted cache to hash-only with env opt-in for source text.
  - Added atomic quota check-and-increment SQL pattern (TOCTOU fix).
  - Added per-user daily char cap.
  - Added "first line: deferReply ephemeral" requirement to interaction flow.
  - Added "no privileged intents; MessageContent stays OFF".
  - Added "container runs non-root" requirement.
  - Renumbered milestones (old M4 dropped → M5/M6/M7 became M4/M5/M6).
- Customized `AGENTS.md` (project name, one-liner, doc index).
- Replaced `README.md` (template package README → real project README).
- Removed template-package files that don't belong in the project tree:
  `BOOTSTRAP_PROMPT.md`, `INSTALL_FOR_CLAUDE.md`, `docs/ARCHITECTURE.md`,
  `docs/meta/HISTORY.md` (+ empty `docs/meta/` dir),
  `docs/agent/sessions/EXAMPLE-session.md.template`,
  `docs/agent/tasks/EXAMPLE-task.md.template`. INSTALL_FOR_CLAUDE.md lines
  121–137 are explicit that these stay in the template package.
- Created multi-session task file
  `docs/agent/tasks/discord-translation-bot.md` (Active: yes) mirroring the
  revised milestones M0–M6 as checkboxes.
- Updated `STATE.md`, `JOURNAL.md`, `DECISIONS.md`.

## Changed files / intent

- `AGENTS.md` — customized `<PROJECT_NAME>` to `discord-translate`, replaced
  one-line description, replaced `<CUSTOMIZE: add real docs here>` line with
  actual project doc index. **Do not revert.**
- `README.md` — full replacement of template-package README with project
  README (stack, scope, layout, session-verb table). **Do not revert.**
- `docs/plans/discord-translation-bot.md` — applied v1 deltas (see "Done"
  section above for the full list). **Do not revert** — this is the
  authoritative product/architecture spec for the active task.
- `docs/agent/STATE.md` — bumped to current state, set Active task,
  updated Latest session read pointer, new Resume prompt for Step 1 (M0).
- `docs/agent/JOURNAL.md` — appended this session's entry.
- `docs/agent/DECISIONS.md` — appended 9 v1 decisions (Google deferral,
  better-sqlite3, hash-only cache, atomic quota, per-user cap,
  allowed_servers drop, owner-from-env, MessageContent OFF, non-root).
- `docs/agent/tasks/discord-translation-bot.md` — **new** task file
  (Active: yes) tracking M0–M6 as checkboxes with decisions and
  current edge.
- `docs/agent/sessions/2026-05-25-222358-claude-bootstrap-and-plan-refinement.md` —
  **this file**.
- Deletions: `BOOTSTRAP_PROMPT.md`, `INSTALL_FOR_CLAUDE.md`,
  `docs/ARCHITECTURE.md`, `docs/meta/HISTORY.md`, `docs/meta/` dir,
  `docs/agent/sessions/EXAMPLE-session.md.template`,
  `docs/agent/tasks/EXAMPLE-task.md.template` — template-only files that
  should not live in the project tree.

## Decisions

All indexed in `docs/agent/DECISIONS.md` with this session as the link.
Highlights (reasoning lives here, index lives there):

- **DeepL only in v1, Google deferred.** 500K char/month covers 3 users
  comfortably; Google adds GCP project + billing + JSON credentials +
  12-month free-tier sunset for a fallback that will never fire. Interface
  is kept so the future adapter doesn't require a rewrite.
- **`better-sqlite3` + tiny startup migrator, no ORM.** 4 tables, zero
  schema-churn pressure. Drizzle/Prisma is dead weight at this scale.
  Revisit if schema grows past ~10 tables.
- **Hash-only cache by default.** Self-review #7 in the plan flagged this;
  storing DM content on the VPS was the wrong default. Env opt-in
  (`CACHE_STORE_SOURCE_TEXT=true`) preserves the debug option without
  making it the default.
- **Atomic SQL quota check-and-increment.** The naive check → call →
  increment pattern is TOCTOU-racy. A single `UPDATE ... WHERE
  characters_used + :n <= :limit` is atomic and tells you via affected-row
  count whether the reservation succeeded.
- **Per-user daily char cap** is independent protection against one friend
  pasting walls of text and torching the shared monthly budget.
- **MessageContent intent stays OFF.** Message context commands deliver
  the target message in the interaction payload; the intent is not needed
  and broadens permission scope unnecessarily.

## Failed approaches / do not retry

- **Do not add Drizzle just because schema typing sounds nice.** For 4 tables
  with zero churn pressure, the dependency cost and the abstraction tax
  outweigh the typing benefit. better-sqlite3's `db.prepare<Params, Row>()`
  is sufficient.
- **Do not store DM source text in the cache by default.** Reasoning above;
  do not flip the env flag in production unless there is a specific debug
  need being investigated, and turn it back off afterwards.
- **Do not commit template-package docs into the project tree** (the deleted
  files). INSTALL_FOR_CLAUDE.md lines 121–137 are explicit. If a future
  agent re-extracts a template tarball into the repo, the same deletions
  apply.
- **Do not add `MessageContent` intent reflexively.** It is not needed for
  message context commands.
- **Do not implement Google adapter "to keep parity"** unless a real reason
  surfaces (DeepL outage tolerance, unsupported language pair encountered
  in practice, etc.).

## Next

1. Start Step 1 (M0): scaffold the TypeScript package. `package.json`,
   `tsconfig.json`, `Dockerfile` (Node official image, `USER node`),
   `docker-compose.yml`, `.env.example`, `.dockerignore`, minimal `src/`
   skeleton.
2. Decide lint/format toolchain (ESLint+Prettier vs. Biome) and package
   manager (npm vs. pnpm) before installing anything. Default suggestion:
   npm + ESLint + Prettier (industry-default; least surprise for
   contributors).
3. Verify on a throwaway Discord app that user-install + DM message
   context menu UX actually works **before** writing provider code
   (plan self-review #2 is the gate). This validates the entire premise.
4. After M0 + M1 verification: proceed to M2 (database + access control).

## Resume prompt

Open `docs/agent/tasks/discord-translation-bot.md` — the active task
file mirrors plan milestones M0–M6 as a checkbox plan. Step 0 (bootstrap +
plan refinement) is done. **Next is Step 1 (M0): scaffold the TypeScript
package.** First file to create: `package.json`. First decision to make:
lint/format toolchain (default suggestion ESLint + Prettier) and package
manager (default suggestion npm). Before writing any Discord client code
in Step 2 (M1), verify the user-install + DM message-context-menu UX on a
throwaway Discord app — this is the gate per plan self-review #2.
Authoritative product spec is `docs/plans/discord-translation-bot.md`;
read its Milestone 0 and Milestone 1 sections. Run
`docs/agent/scripts/drift-check.sh` first.
