# State

**Protocol version:** 2
**Updated:** 2026-05-26T17:47:46+02:00
**Tool last wrote:** Codex CLI
**Branch:** master
**Last code commit:** b8c55273284fffd85773b4f6bf4829f80a6335ab docs(plan): refine translation bot plan
**Code worktree:** dirty
**Tracked dirty code paths:** none
**Relevant untracked code paths:** docs/plans/deep-research-report.md — research/advisory report used to refine the canonical plan; still untracked, do not assume it is committed
**Active task:** discord-translation-bot
**Latest session read:** docs/agent/sessions/2026-05-25-222358-claude-bootstrap-and-plan-refinement.md

## Now

Canonical implementation plan was reread, compared with the untracked deep
research report, and refined in-place. The plan now includes rationale comments
for major choices, tighter Discord interaction guidance, DeepL language mapping,
placeholder integrity checks, reservation refund rules, and a deliberate
Post-V1/V2 evolution section. User rejected a default per-user daily cap; v1
now uses provider monthly quota as the hard stop, with optional per-user
throttle deferred until real abuse/noise appears.

## Resume prompt

Open `docs/plans/discord-translation-bot.md` and
`docs/agent/tasks/discord-translation-bot.md`. The product/architecture plan is
the current source of truth. Step 0 plan refinement is complete; **next
concrete step is Step 1 (M0): scaffold the TypeScript package**:
`package.json`, `tsconfig.json`, lint/format/test/typecheck scripts,
`Dockerfile`, `docker-compose.yml`, `.env.example`, `.dockerignore`, and a
minimal `src/` skeleton. Default to npm + ESLint/Prettier unless a stronger
repo-local reason appears. Before provider work, M1 must verify Discord
user-install + message-context command UX in DMs/group DMs.

## In flight

- `docs/plans/discord-translation-bot.md` was committed separately as
  `b8c5527 docs(plan): refine translation bot plan`.
- `docs/agent/tasks/discord-translation-bot.md` mirrors the updated plan edge
  and daily-cap reversal.
- `docs/agent/DECISIONS.md` has a new append-only reversal entry for the
  daily-cap decision.
- `docs/plans/deep-research-report.md` remains untracked advisory input.

## Next

1. Start Step 1 (M0): create `package.json`, `tsconfig.json`, `Dockerfile`,
   `docker-compose.yml`, `.env.example`, `.dockerignore`, and basic `src/`
   skeleton.
2. Decide lint/format toolchain (default: ESLint + Prettier) and package
   manager (default: npm).
3. In Step 2 (M1), verify on a throwaway Discord app that user-install +
   `Apps -> Translate` appears in DMs/group DMs before writing provider code.
4. Keep `docs/plans/deep-research-report.md` untracked unless the user decides
   it should be kept as a committed reference.

## Open questions / blockers

- Lint/format toolchain choice: ESLint + Prettier vs. Biome.
- Package manager: npm vs. pnpm.
- Group DM behaviour: treat as DM or disable until tested? Decide during M1
  manual verification.
- Should `docs/plans/deep-research-report.md` be committed as background
  reference or deleted/ignored as scratch?

## Environments

- Local dev: Linux host with Node 20+ and Docker expected (not yet set up;
  pending Step 1 (M0)).
  verify-with: `docs/agent/scripts/drift-check.sh`
- VPS: 4 CPU / 8 GB RAM, shared with other projects, Docker installed. Bot
  service not yet deployed.
  verify-with: (set after Step 7 (M6) deployment)
