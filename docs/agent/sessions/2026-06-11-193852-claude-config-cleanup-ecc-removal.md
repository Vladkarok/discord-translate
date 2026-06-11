# Session 2026-06-11 19:38:52 — claude — config-cleanup-ecc-removal

**Tool:** Claude Code
**Started from session:** docs/agent/sessions/2026-06-11-182111-claude-remove-dual-graph-mempalace.md
**Branch:** master
**Code worktree:** clean (code); AGENTS.md, CLAUDE.md, docs/agent/PROTOCOL.md dirty (memory-tier, staged in this save)
**Tracked dirty code paths:** none
**Relevant untracked code paths:** docs/plans/deep-research-report.md (carried over; user decision pending)
**Active task:** none

## Done

- Audited Stop hooks across all config scopes. Found and removed four
  dead dual-graph hooks (SessionStart/PreCompact/Stop/PreToolUse) from
  this repo's `.claude/settings.local.json` — they pointed at the
  `.dual-graph/` scripts deleted in the previous session.
- Compared `~/.claude/settings.json` against the current settings
  reference and 2.1.126–2.1.173 changelogs. Applied: `attribution:
  {commit: "", pr: ""}` (the rules' claim that attribution was
  disabled had been stale — `includeCoAuthoredBy` is deprecated);
  removed dead `ENABLE_PROMPT_CACHING_1H` env var; raised
  `MAX_THINKING_TOKENS` 10000 → 32000 (on Fable/Opus 4.8 `effortLevel`
  is the primary lever; 32k ceiling never truncates real reasoning).
- Uninstalled the everything-claude-code (ECC) plugin entirely
  (~58M freed): `claude plugin uninstall` + `marketplace remove`,
  deleted leftover cache, dropped the dead 50-entry `skillOverrides`
  block. Rationale: it injected a wrong-project session summary at
  this session's start, collided with the repo protocol, duplicated
  built-ins (/code-review, Plan mode, Explore), and ran ~17 hooks of
  telemetry per session. Kept umputun plugins (review/planning/
  thinking-tools).
- Trimmed ECC references from global rules: rewrote
  `~/.claude/rules/common/{agents,development-workflow,performance}.md`
  for built-ins and current model reality (Fable 5 default, 32k
  thinking cap); spot-fixed `common/{security,testing}.md` and
  `typescript/{security,testing}.md`.
- Generalized this repo's identity docs away from dead ECC naming
  while keeping the vendor-collision rule: `CLAUDE.md` (three
  ECC bullets → two generic ones), `AGENTS.md` (authority item 6
  "ECC hooks" → "plugin hooks"), `docs/agent/PROTOCOL.md` (pitfalls
  entry generalized).
- Scanned all 13 `~/Work/**/.claude/settings.local.json` files:
  all valid; `email-to-telegram-internal`'s dual-graph hooks are live
  by design (install kept there); `youtube-download-bot` has an
  intentional black/ruff/mypy PostToolUse hook; removed one stale
  permission (`rm -fv __pycache__/mcp_graph_server.*`) from
  `~/Work/.claude/settings.local.json`.
- Answered `/recap` provenance (built-in away-summary feature, not a
  plugin); disabled it per user request (`awaySummaryEnabled: false`).
- Earlier check: `email-to-telegram-internal`'s dual-graph index was
  re-scanned by the user (2026-06-11 18:18, now newer than HEAD there)
  — no longer stale.

## Changed files / intent

- `CLAUDE.md` — ECC-specific advisory bullets replaced with generic
  vendor-collision wording. Do not re-add ECC references; the plugin
  is uninstalled machine-wide.
- `AGENTS.md` — authority order item 6: "ECC hooks" → "plugin hooks".
- `docs/agent/PROTOCOL.md` — "Vendor session machinery may collide"
  pitfall generalized (no ECC naming).
- Machine-local (not in repo): `~/.claude/settings.json`,
  `~/.claude/rules/common/*` + `typescript/*`,
  `~/Work/.claude/settings.local.json`,
  `.claude/settings.local.json` (gitignored), plugin dirs.

## Decisions

- **ECC plugin uninstalled machine-wide; repo docs generalized.**
  Built-ins + umputun plugins cover everything it provided; it
  actively injected wrong-project context. The repo keeps the generic
  "repo protocol wins over vendor machinery" rule — that protection
  stays, only the dead plugin naming left. (Indexed in DECISIONS.md.)
- MAX_THINKING_TOKENS 32000: effort level is the primary reasoning
  lever on Fable; the cap is a runaway guard, not a budget.

## Failed approaches / do not retry

- Writing `.claude/settings.local.json` was first denied by the auto
  mode classifier (self-modification before user approval). Approved
  edits went through fine afterwards — ask/confirm before editing
  permission files mid-conversation.

## Next

1. User restarts Claude Code (clears the 4 orphaned ECC Stop-hook
   errors in the still-running session; on-disk config verified clean).
2. Resolve `docs/plans/deep-research-report.md` (commit, delete, or
   `.gitignore`).
3. Feature work when usage demands it — open
   `docs/agent/tasks/<slug>.md` per AGENTS.md hard rule #6.

## Resume prompt

The bot is live in production with CI/CD; no code changes since
`0085a33`. Today was config hygiene: dual-graph MCP removed from this
repo, mempalace and the everything-claude-code plugin uninstalled
machine-wide, `~/.claude/settings.json` modernized (attribution
disabled properly, thinking cap 32000, away summary off), global rules
and this repo's CLAUDE.md/AGENTS.md/PROTOCOL.md trimmed of dead ECC
references. Expect no ECC skills/hooks/agents anywhere — use built-ins
(/code-review, Plan mode, Explore agent). No active task. First open
item: the untracked `docs/plans/deep-research-report.md`
(commit/delete/ignore — user decision). Verify prod health with
`ssh kc-vprojects 'cd apps/discord-translate && docker compose --env-file .env ps'`.
