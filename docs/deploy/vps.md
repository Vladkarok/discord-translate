# VPS deployment

What this doc covers: getting the bot running on a small Linux VPS
with Docker, keeping it running, updating it, and backing up the
SQLite state.

Tested on Debian 12 and Ubuntu 24.04. Should work on any distro with
Docker Engine 24+ and the Compose plugin.

## Prereqs

- A VPS you SSH into (1 vCPU / 512 MB RAM is enough).
- Docker Engine + Compose plugin:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER          # log out + back in after this
  docker compose version                  # confirm "Docker Compose version v2.x"
  ```
- `.env` values from `docs/deploy/discord-app.md` and
  `docs/deploy/google-cloud.md`.

## First deploy

```bash
git clone https://github.com/<you>/discord-translate.git
cd discord-translate
cp .env.example .env
# Edit .env: fill DISCORD_TOKEN, DISCORD_CLIENT_ID, OWNER_DISCORD_ID,
# GOOGLE_TRANSLATE_API_KEY. Leave the rest at defaults.

docker compose up --build -d
docker compose logs -f bot
```

Healthy startup looks like:

```
{"level":"info","msg":"bot.starting",...}
{"level":"info","msg":"db.opened","path":"/data/bot.sqlite"}
{"level":"info","msg":"db.migrated",...}
{"level":"info","msg":"commands.registered","count":5}
{"level":"info","msg":"bot.ready"}
```

Ctrl-C exits the log follow; the bot keeps running (because
`docker compose up -d` detached it).

Now install via your user-install URL (from the Discord setup doc),
Ctrl/Cmd + R the Discord client, and try `Apps → Translate`.

## Update

```bash
cd ~/discord-translate
git pull
docker compose up --build -d
docker compose logs --tail=50 bot
```

Volume `bot-data` persists across rebuilds, so allowlist, saved
preferences, quota counter, and cache survive.

## Daily ops

```bash
docker compose ps                          # is it running?
docker compose logs -f bot                  # follow logs
docker compose logs --tail=200 bot          # recent logs
docker compose restart bot                  # bounce without rebuild
docker compose stop bot                     # stop (volume stays)
docker compose down                         # stop + remove container (volume stays)
docker compose down -v                      # ALSO delete the named volume — DESTRUCTIVE
```

## Backups

The bot owns one piece of stateful data: the SQLite file inside the
`bot-data` named volume. Two scripts in `scripts/` automate this.

```bash
# Snapshot
./scripts/backup-sqlite.sh ./backups/dt-$(date +%Y%m%d-%H%M).tgz

# Cron daily at 04:00
crontab -e
0 4 * * * cd $HOME/discord-translate && ./scripts/backup-sqlite.sh ./backups/dt-$(date +\%Y\%m\%d).tgz >> ./backups/cron.log 2>&1
```

Restore (stops the bot during the swap):

```bash
docker compose down
./scripts/restore-sqlite.sh ./backups/dt-20260601.tgz
docker compose up -d
```

What's in a backup:

- `users` table — allowlisted friend Discord IDs and their saved
  target language / server-usage flag
- `owner_prefs` — your saved default target
- `provider_usage` — running monthly character count (resets next
  billing month)
- `translation_cache` — hash-only cached translations (rebuildable;
  losing this only costs a few extra Google calls)

## Troubleshooting

| Symptom | Diagnose with | Likely fix |
|---|---|---|
| Container restart loop | `docker compose logs bot \| tail -50` | `.env` missing a required var → fail-fast Zod message tells you which |
| `unable to open database file` | logs above | Compose was using a bind mount with wrong ownership. Current `docker-compose.yml` uses a named volume; pull latest |
| `provider.error kind=auth` | logs | `GOOGLE_TRANSLATE_API_KEY` wrong/revoked/not scoped to Translation API |
| Discord commands missing in client | client devtools / `Ctrl+R` | Cache stale — refresh client. If still missing after refresh, check `commands.registered` log line on last boot |
| Bot answers but translation panel doesn't toggle | logs | Session expired — TTL is 20 min. Right-click message, run Translate again |
| `/quota status` says characters_used near limit | n/a | Monthly billing window resets on the first of each calendar month UTC. Until then, the bot refuses to call Google |

## Logs format

One JSON object per line. Useful filters:

```bash
# Just translations
docker compose logs bot | grep '"msg":"translate.'

# Errors only
docker compose logs bot | grep '"level":"error"'

# Quota events
docker compose logs bot | grep 'quota\|provider_usage\|google'
```

The logger never writes message bodies. Logged fields are user IDs,
language codes, character counts, billing categories, and latencies —
private enough to share when filing an issue.

## Hardening (optional)

- **Firewall:** the bot makes outbound calls to Discord gateway +
  REST and to translation.googleapis.com. No inbound ports needed.
  Default-deny inbound is safe.
- **Non-root container:** already the case (Dockerfile uses
  `USER node`).
- **Updates:** GitHub watcher → `git pull && docker compose up --build -d`,
  or just check weekly.
- **Token rotation:** rotate `DISCORD_TOKEN` in the Developer Portal
  and update `.env` if you suspect leak. Bot reconnects on next
  restart. Same for `GOOGLE_TRANSLATE_API_KEY`.
