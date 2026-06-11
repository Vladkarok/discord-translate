# Session 2026-06-11 18:21:11 — claude — remove-dual-graph-mempalace

**Tool:** Claude Code
**Started from session:** docs/agent/sessions/2026-05-28-204630-claude-cicd-and-russian.md
**Branch:** master
**Code worktree:** clean
**Tracked dirty code paths:** none
**Relevant untracked code paths:** docs/plans/deep-research-report.md (carried over; user decision pending)
**Active task:** none

## Done

- `start session` drift check found uncommitted edits to `.gitignore`
  (added `.dual-graph/`) and `CLAUDE.md` (appended ~85-line
  `dgc-policy-v11` block) — written by the dual-graph MCP installer
  after the 2026-05-28 save, not lost work.
- Analyzed whether the dual-graph MCP server earns its keep here.
  Evidence: project is 27 TS files / ~2.6k LOC (whole `src/` ≈ 25–30k
  tokens); policy block costs ~1.1k tokens every session; live
  `graph_continue` test returned a good 3-file recommendation but
  saves at most ~1–2k tokens vs one grep — break-even at best;
  `.dual-graph/context-store.json` was `[]` after two weeks (memory
  half never used; `docs/agent/` already covers it better); its
  `confidence=high → 0 greps allowed` caps are actively harmful on a
  small repo; index staleness is structural because Codex CLI edits
  without `graph_register_edit`.
- Removed dual-graph from this project: `git checkout -- .gitignore
  CLAUDE.md`, deleted `.dual-graph/` (380K), removed the `dual-graph`
  entry from `~/.claude.json` → projects → this repo.
- Audited the other install: `~/Work/email-to-telegram-internal`
  (268 source files, ~42k LOC, graph 368 files/850 symbols, context
  store actively used with 44 entries). Verdict: worth keeping there,
  but index is stale — last scan 2026-05-29, 9 commits behind (through
  2026-06-10); needs a `graph_scan` re-index next session there.
- Identified `token-counter` MCP origin: global `~/.claude.json`
  `mcpServers`, runs `npx -y token-counter-mcp@latest` (nothing
  installed on disk; `@latest` auto-upgrade flagged as mild
  supply-chain exposure). Kept.
- Uninstalled mempalace entirely (~610M freed): pipx package
  `mempalace 3.0.0` + venv (426M), `~/.mempalace` data dir (184M —
  ChromaDB index + SQLite knowledge graph; inactive since 2026-04-30),
  MCP entry in `~/.claude.json` scoped to `~/Work`, and 15 stale
  permission entries in `~/Work/.claude/settings.local.json`. Its
  hooks were not registered anywhere, so nothing breaks.
- User deleted the `~/.claude.json.bak-dualgraph` safety backup after
  confirming.

## Changed files / intent

- No repo file changes beyond `docs/agent/` memory (this save).
  `.gitignore` and `CLAUDE.md` were restored to HEAD (reverting the
  third-party installer's edits — intentional, do not re-apply).
  All other changes were machine-local (`~/.claude.json`,
  `~/Work/.claude/settings.local.json`, pipx venvs, `~/.mempalace`).

## Decisions

- Dual-graph MCP removed from this repo: fixed per-session cost
  (~1.1k-token CLAUDE.md policy + tool ceremony) exceeds plausible
  retrieval savings on a 27-file/2.6k-LOC codebase; its context store
  duplicated `docs/agent/` and was empty after two weeks. Built-in
  Grep/Glob/Read is the better fit at this scale.
  (Indexed in DECISIONS.md.)
- Keep dual-graph in `email-to-telegram-internal` (42k LOC — right
  scale for it) but it needs a `graph_scan` re-index there; the
  `graph_register_edit` discipline demonstrably hasn't kept it fresh.
- mempalace uninstalled fleet-wide (machine-local): unused since
  2026-04-30, 610M of disk for no active value.

## Failed approaches / do not retry

- None. (Removal was clean; no hook registrations existed, so no
  broken-hook cleanup was needed.)

## Next

1. Use the bot; let real friction pull a V1.x or V2 task.
2. Resolve `docs/plans/deep-research-report.md` (commit, delete, or
   `.gitignore`).
3. Next session in `email-to-telegram-internal`: run `graph_scan` to
   re-index its stale dual-graph store (9 commits behind as of
   2026-06-11).

## Resume prompt

The bot is live in production with CI/CD (push to `master` → GHCR →
self-hosted runner deploys to VPS); no code changes since `0085a33`.
This session removed the dual-graph MCP from this repo (CLAUDE.md and
.gitignore reverted to HEAD, `.dual-graph/` deleted, MCP entry removed
from `~/.claude.json`) and uninstalled mempalace machine-wide — do not
expect `graph_continue`/`graph_read` tools in this repo; use built-in
retrieval. No active task. First open item: the untracked
`docs/plans/deep-research-report.md` (commit/delete/ignore — user
decision). Verify prod health with
`ssh kc-vprojects 'cd apps/discord-translate && docker compose --env-file .env ps'`.
