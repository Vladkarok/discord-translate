# Session 2026-05-28 20:46:30 — claude — cicd-and-russian

**Tool:** Claude Code
**Started from session:** docs/agent/sessions/2026-05-27-224000-claude-v1-complete.md
**Branch:** master
**Code worktree:** clean
**Tracked dirty code paths:** none
**Relevant untracked code paths:** docs/plans/deep-research-report.md (carried over from v1; user decision pending)
**Active task:** none

## Done

- Created private GitHub repo `Vladkarok/discord-translate` and pushed
  v1 history (8 prior commits) via `gh repo create --push`.
- Added GitHub Actions CI workflow: `npm run typecheck && lint && format:check`
  on push to `master` and PRs against `master`.
- Added Deploy workflow modeled on `Vladkarok/youtube-download-bot`:
    - GH-hosted job builds and pushes `ghcr.io/vladkarok/discord-translate`
      with `:<short-sha>` and `:latest` tags using `secrets.GITHUB_TOKEN`.
    - Self-hosted job (label `disctrans`) runs `scripts/deploy.sh`,
      which scps compose, logs into GHCR, pulls image, restarts
      compose, and asserts the container stays running for ~20s
      without crash-loops or restarts.
- Edited `docker-compose.yml` so `image:` resolves to
  `ghcr.io/vladkarok/discord-translate:${IMAGE_TAG:-dev}` — local
  `docker compose build && up` keeps working (default `:dev`); prod
  uses the registry image with `--no-build`.
- Provisioned `gh-disctrans` Unix user on `kc-github-runner` (sudo),
  extracted actions-runner v2.334.0 from `gh-tgaudio`'s tarball,
  generated ed25519 keypair `~/.ssh/disctrans_vprojects_deploy`,
  wrote `~/.ssh/config` with `disctrans-vprojects` alias to
  `vladkarok@10.0.88.3`, pre-populated `~/.ssh/known_hosts`.
- Registered runner with GitHub via short-lived registration token
  from `gh api -X POST /repos/.../actions/runners/registration-token`,
  installed and started as systemd service
  `actions.runner.Vladkarok-discord-translate.kc-runner-github-disctrans.service`.
- Authorized the runner's public key on VPS `~vladkarok/.ssh/authorized_keys`
  with `from="10.0.89.2",no-pty,no-port-forwarding,no-X11-forwarding,no-agent-forwarding`
  (same restriction model as `tg-audio-dl`; not forced-command).
- Created VPS app dir `/home/vladkarok/apps/discord-translate`, scp'd
  local `.env` to it (mode 600). Stopped the local container to free
  the Discord gateway lock for the prod instance.
- Triggered initial deploy via push; bot is live as `Translate4Friends`
  on image `:d5c3b5a`.
- Follow-on commit `0085a33` added Russian (`ru`) to:
    - `src/providers/google.ts` SUPPORTED_TARGETS and SUPPORTED_SOURCES,
    - `src/interactions/components.ts` SUPPORTED_LANGS (shared by both
      Source and Target selects),
    - `src/interactions/translate.ts` LOCALE_TO_ISO map (so Discord
      clients with locale `ru` default the target to Russian).
- Verified live use after deploy: friends translating fr↔uk in
  production with sub-400 ms total latency.

## Changed files / intent

- `.github/workflows/ci.yml` — new. Typecheck/lint/format gate.
- `.github/workflows/deploy.yml` — new. Build+push+deploy pipeline.
- `scripts/deploy.sh` — new. Runner-side deploy entrypoint (mirrors
  the `youtube-download-bot` `scripts/deploy.sh` shape; chmod +x).
- `docker-compose.yml` — `image:` now references GHCR tag with
  `${IMAGE_TAG:-dev}` fallback so local builds still tag a `:dev`
  image and prod pulls a SHA tag with `--no-build`.
- `src/providers/google.ts` — added `'ru'` to SUPPORTED_TARGETS and
  SUPPORTED_SOURCES; updated doc comment.
- `src/interactions/components.ts` — added `{ value: 'ru', label:
  'Russian' }` to SUPPORTED_LANGS; updated panel-layout doc comment.
- `src/interactions/translate.ts` — added `ru: 'ru'` to LOCALE_TO_ISO.
- `src/sessions/store.ts` — updated currentSource/currentTarget doc
  comments to include `'ru'`.

## Decisions

- **Deploy via GHCR + self-hosted runner, not rsync-and-build-on-VPS.**
  Adopted the pattern already used by `youtube-download-bot`,
  `email-to-telegram`, and `shiny`. Same trust model, same operator
  ergonomics, consistent with the rest of the user's fleet.
  (Indexed in DECISIONS.md.)
- **VPS SSH key restriction: `from=IP` + no-pty/no-fwd, NOT
  forced-command.** Matches `tg-audio-dl` (the most recent peer);
  shiny's forced-command wrapper adds drift between the VPS script
  and the workflow that we don't need here. (Indexed in DECISIONS.md.)
- **Deploy trigger = push to `master` + `workflow_dispatch`.** No
  release-tag ritual for a personal bot iterating rapidly. Matches
  `email-to-telegram` staging.
- **`.env` lives only on the VPS and locally; workflow never touches
  it.** User-preferred — one-time scp on rotation. Workflow has a
  startup guard that fails fast if `.env` is missing in the app dir.
- **Image-tag SHA + `:latest` mirror.** SHA is the addressable
  identity (matches container `image` in `docker ps`); `:latest`
  is convenience for `workflow_dispatch` without arguments.

## Failed approaches / do not retry

- **Unquoted `from=10.0.89.2` in VPS `authorized_keys`.** sshd
  rejected auth silently (publickey denied, no informative log at
  default LogLevel). Quote the value: `from="10.0.89.2"`. The two
  existing entries (shiny, tg-audio-dl) both use the quoted form;
  copying the new entry without quotes wasted ~5 min of debugging.

## Next

1. Use the bot for a while; let real friction pull a V1.x or V2 task.
2. Resolve `docs/plans/deep-research-report.md` (commit, delete, or
   `.gitignore`).
3. If a multi-session task arises, open `docs/agent/tasks/<slug>.md`
   per AGENTS.md hard rule #6.

## Resume prompt

The bot is in production with a full CI/CD pipeline; v1 work is
finished. Push to `master` deploys automatically: ubuntu-latest builds
and pushes to GHCR (`ghcr.io/vladkarok/discord-translate:<sha>` +
`:latest`); self-hosted runner `kc-runner-github-disctrans` (label
`disctrans`, on `kc-github-runner`) deploys via `scripts/deploy.sh`,
which SSHes through alias `disctrans-vprojects` to the VPS and runs
`docker compose --env-file .env pull && up -d --no-build` with a
~20-second crash-loop guard. App dir on VPS:
`/home/vladkarok/apps/discord-translate` (compose + `.env`; data in
named volume `discord-translate_bot-data`). To redeploy a specific
image: `gh workflow run deploy.yml -f image_tag=<sha>`. To rotate
secrets: edit local `.env`, scp to VPS, re-run deploy. No active task;
next feature work should open `docs/agent/tasks/<slug>.md`.
