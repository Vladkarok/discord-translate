# State

**Protocol version:** 2
**Updated:** 2026-06-11T19:38:52+02:00
**Tool last wrote:** Claude Code
**Branch:** master
**Last code commit:** 0085a33c6abbe9c3e7be36f8219a6392ea2f2335 feat: add Russian as supported translation language
**Code worktree:** clean
**Tracked dirty code paths:** none (AGENTS.md/CLAUDE.md/PROTOCOL.md dirty are memory-tier, staged in this save)
**Relevant untracked code paths:** docs/plans/deep-research-report.md — advisory research input from v1 plan refinement; user still hasn't decided to commit, delete, or .gitignore it
**Active task:** none
**Latest session read:** docs/agent/sessions/2026-06-11-182111-claude-remove-dual-graph-mempalace.md

## Now

v1 + CI/CD is in production; no code changes since 0085a33 (image
`:0085a33` on the VPS, includes Russian). Today's two sessions were
tooling hygiene: dual-graph MCP removed from this repo, mempalace and
the everything-claude-code plugin uninstalled machine-wide, global
rules files and this repo's identity docs trimmed of ECC-specific
wording (generic vendor-collision rule retained).

## Resume prompt

The bot is live in production. Push to `master` triggers an automatic
deploy: GitHub-hosted runner builds and pushes
`ghcr.io/vladkarok/discord-translate:<short-sha>` and `:latest`, then
the self-hosted runner `kc-runner-github-disctrans` (Unix user
`gh-disctrans` on `kc-github-runner`) SSHes to VPS via alias
`disctrans-vprojects`, runs `docker compose pull && up -d --no-build`,
asserts the container stays up ~20s. To redeploy a specific image
without code changes: `gh workflow run deploy.yml -f image_tag=<sha>`.
`.env` lives only on the VPS (and locally); rotate via
`scp ~/Work/discord-translate/.env kc-vprojects:/home/vladkarok/apps/discord-translate/.env`
then re-run deploy. If something fails post-deploy, start with
`ssh kc-vprojects 'cd apps/discord-translate && docker compose --env-file .env logs --tail 50 bot'`.
The ECC plugin and dual-graph MCP no longer exist on this machine —
ignore any stale references; use built-in retrieval and `/code-review`.
No active task; open a fresh task file under `docs/agent/tasks/` when
new multi-session work appears.

## In flight

- Nothing in flight.
- `docs/plans/deep-research-report.md` is still untracked; pending
  user decision (commit/delete/ignore).

## Next

1. (User decision) Resolve the untracked `deep-research-report.md`.
2. (User-initiated, when usage demands) Open a task file for V1.x
   polish (embed translation, attachment translation, per-user throttle)
   or V2 (LLM tone mode, local MT, etc.) per
   `docs/plans/discord-translation-bot.md` §Post-V1 Evolution.

## Open questions / blockers

- Fate of `docs/plans/deep-research-report.md`: commit as appendix,
  delete as scratch, or `.gitignore`.

## Environments

- Local dev (Linux, Docker + Compose): bot container stopped to avoid
  Discord gateway conflict with prod.
  verify-with: `docker ps --filter name=discord-translate --format '{{.Names}} {{.Status}}'`
- VPS (`ssh kc-vprojects`): healthy, image `ghcr.io/vladkarok/discord-translate:<sha>`
  at `/home/vladkarok/apps/discord-translate`, SQLite in named volume
  `discord-translate_bot-data`.
  verify-with: `ssh kc-vprojects 'cd apps/discord-translate && docker compose --env-file .env ps'`
- Runner (`ssh kc-github-runner`): user `gh-disctrans`, systemd unit
  `actions.runner.Vladkarok-discord-translate.kc-runner-github-disctrans.service`,
  label `disctrans`, SSH alias `disctrans-vprojects` → VPS via
  `~/.ssh/disctrans_vprojects_deploy` (IP-locked + non-interactive on VPS authorized_keys).
  verify-with: `ssh kc-github-runner 'sudo systemctl is-active actions.runner.Vladkarok-discord-translate.kc-runner-github-disctrans.service'`
