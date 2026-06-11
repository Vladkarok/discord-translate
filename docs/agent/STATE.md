# State

**Protocol version:** 2
**Updated:** 2026-06-12T00:14:55+02:00
**Tool last wrote:** Claude Code
**Branch:** master
**Last code commit:** 727a53ea07725f92391213c4a6b2a0ea9d16dc8b test: vitest suite for pure modules (66 cases); CI gates on tests
**Code worktree:** clean
**Tracked dirty code paths:** none
**Relevant untracked code paths:** docs/plans/deep-research-report.md — advisory research input; user decision still pending (commit/delete/ignore)
**Active task:** none
**Latest session read:** docs/agent/sessions/2026-06-11-193852-claude-config-cleanup-ecc-removal.md

## Now

Full code-review pass landed: 4 bugs fixed (fail-closed /quota context,
stale embeds on panel failure, literal ⟦N⟧ masking, language validation
via new src/languages.ts), lifecycle polish (version 1.0.0 from
package.json, daily cache prune, shutdown watchdog, API key in header),
and the first test suite — 66 vitest cases, CI now gates on `npm test`.
Commits `c0c3d42` (fix) + `727a53e` (test). Deploying to prod now: push
to master triggers build of `ghcr.io/vladkarok/discord-translate:727a53e`
and auto-deploy to the VPS.

## Resume prompt

The bot is live in production; the code-review hardening (c0c3d42 +
727a53e) was pushed to master this session, which auto-deploys. First
verify the deploy landed: `gh run list --limit 3` should show CI + deploy
green, then
`ssh kc-vprojects 'cd apps/discord-translate && docker compose --env-file .env ps'`
should show image tag `:727a53e` (or later) and Up. If the container is
unhealthy, check
`ssh kc-vprojects 'cd apps/discord-translate && docker compose --env-file .env logs --tail 50 bot'`
— rollback is `gh workflow run deploy.yml -f image_tag=0085a33`. Tests
run with `npm test` (66 cases, tests/). No active task; the only loose
end is the untracked `docs/plans/deep-research-report.md` (user
decision: commit/delete/ignore).

## In flight

- Deploy of `727a53e` to prod (push + CI + deploy workflow) — verify
  completion if this session was interrupted before confirmation.
- `docs/plans/deep-research-report.md` still untracked; pending user
  decision.

## Next

1. Confirm deploy green + container on `:727a53e` (verify-with below).
2. (User decision) Resolve the untracked `deep-research-report.md`.
3. Feature work when usage demands it (V1.x polish or V2 per
   `docs/plans/discord-translation-bot.md` §Post-V1 Evolution) — open a
   task file per AGENTS.md hard rule #6.

## Open questions / blockers

- Fate of `docs/plans/deep-research-report.md`: commit as appendix,
  delete as scratch, or `.gitignore`.

## Environments

- Local dev (Linux, Docker + Compose): bot container stopped to avoid
  Discord gateway conflict with prod.
  verify-with: `docker ps --filter name=discord-translate --format '{{.Names}} {{.Status}}'`
- VPS (`ssh kc-vprojects`): expected image
  `ghcr.io/vladkarok/discord-translate:727a53e` after this session's
  deploy (was `:0085a33`, up 13 days, before it), SQLite in named volume
  `discord-translate_bot-data`.
  verify-with: `ssh kc-vprojects 'cd apps/discord-translate && docker compose --env-file .env ps'`
- Runner (`ssh kc-github-runner`): user `gh-disctrans`, systemd unit
  `actions.runner.Vladkarok-discord-translate.kc-runner-github-disctrans.service`,
  label `disctrans`, SSH alias `disctrans-vprojects` → VPS via
  `~/.ssh/disctrans_vprojects_deploy` (IP-locked + non-interactive on VPS authorized_keys).
  verify-with: `ssh kc-github-runner 'sudo systemctl is-active actions.runner.Vladkarok-discord-translate.kc-runner-github-disctrans.service'`
