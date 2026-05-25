# State

**Protocol version:** 2
**Updated:** 2026-05-25T22:23:58+02:00
**Tool last wrote:** Claude Code
**Branch:** master
**Last code commit:** 90c952b feat: initialize project — README and v1 translation plan
**Code worktree:** dirty
**Tracked dirty code paths:** none
**Relevant untracked code paths:** none after this save — bootstrap commits stage everything intentional; deletions of template-package files (BOOTSTRAP_PROMPT.md, INSTALL_FOR_CLAUDE.md, docs/ARCHITECTURE.md, docs/meta/, EXAMPLE-*.template) are also staged in the project commit
**Active task:** discord-translation-bot
**Latest session read:** docs/agent/sessions/2026-05-25-214703-codex-translation-plan.md

## Now

Bootstrapping project chrome and locking down the v1 translation-bot plan.
Identity files (AGENTS.md, CLAUDE.md, .codex/notes.md) carry real project
content; README.md replaced; plan refined per user's Q1–Q3 answers (DeepL
only, personal scale, VPS Docker confirmed). Template-package files
removed. Multi-session task `discord-translation-bot` is now Active.

## Resume prompt

Open `docs/agent/tasks/discord-translation-bot.md` — it mirrors plan
milestones M0–M6 as a checkbox plan and lists decisions and the
"current edge". Step 0 is done; **next concrete step is Step 1 (M0)**:
scaffold the TypeScript package, Dockerfile, and `docker-compose.yml`
under the repo root. Before any Discord client code, **verify on a
throwaway Discord app** that user-install + message-context-menu UX
actually works in DMs (self-review #2 in the plan is the gate). First
file to open: `docs/plans/discord-translation-bot.md`, section
"Milestone 0" and "Milestone 1". First command to verify environment:
`docs/agent/scripts/drift-check.sh`.

## In flight

- Two-commit bootstrap is in progress in this session:
  - Commit 1 (project): README.md, docs/plans/discord-translation-bot.md,
    + deletions of template-package files.
  - Commit 2 (agent): AGENTS.md, CLAUDE.md, .codex/notes.md, .gitignore,
    PROTOCOL.md, scripts/*.sh, .gitkeeps, deploy-staging.yml.example,
    STATE.md, JOURNAL.md, DECISIONS.md, new session file, new task file.
- Both commits are local-only; no `publish session` until user asks.

## Next

1. Start Step 1 (M0): create `package.json`, `tsconfig.json`, `Dockerfile`,
   `docker-compose.yml`, `.env.example`, `.dockerignore`, basic `src/`
   skeleton.
2. Decide lint/format toolchain (ESLint+Prettier vs. Biome).
3. Decide `npm` vs `pnpm` (default npm unless reason emerges).
4. Verify Discord user-install + DM message-context-menu UX on a
   throwaway app **before** writing provider code.

## Open questions / blockers

- Lint/format toolchain choice: ESLint+Prettier vs. Biome.
- Package manager: npm vs. pnpm.
- Group DM behaviour: treat as DM or disable until verified?

## Environments

- Local dev: macOS/Linux host with Node 20+ and Docker installed
  (not yet set up; pending Step 1 (M0)).
  verify-with: `docs/agent/scripts/drift-check.sh`
- VPS: 4 CPU / 8 GB RAM, shared with other projects, Docker installed.
  Bot service not yet deployed.
  verify-with: (set after Step 7 (M6) deployment)
