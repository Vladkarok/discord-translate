# discord-translate

Personal Discord translation bot. The owner and a small allowlist of
friends select a Discord message, hit `Apps → Translate`, and get an
ephemeral translation visible only to them — with optional controls to
override source/target language and save a default.

- **Translator:** Google Cloud Translation v2 (500K chars/month free tier)
- **Storage:** SQLite (`better-sqlite3`) on a Docker named volume
- **Deploy:** single container via Docker Compose, intended for a small VPS
- **Audience:** owner + 2 friends. Not a multi-tenant service.

---

## Quick start

You need: a small Linux VPS with Docker + Compose, a Discord account,
and a Google Cloud account (free tier).

```bash
git clone https://github.com/<you>/discord-translate.git
cd discord-translate
cp .env.example .env
# fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, OWNER_DISCORD_ID,
# GOOGLE_TRANSLATE_API_KEY — see docs/deploy/ for portal walk-throughs.

docker compose up --build -d
docker compose logs -f bot
```

When the log shows `commands.registered { count: 5 }` and `bot.ready`,
open Discord, install the bot via your **user-install URL** (from the
Discord Developer Portal), then right-click any message in any DM and
pick `Apps → Translate`.

If `Apps → Translate` doesn't appear, hit **Ctrl/Cmd + R** in Discord
to force a slash-command cache refresh.

---

## Setup walk-throughs

Three short focused guides — read them in this order on first install:

1. **[docs/deploy/discord-app.md](docs/deploy/discord-app.md)** — create
   the Discord app, enable user-install, get the bot token + client ID
   + install URL.
2. **[docs/deploy/google-cloud.md](docs/deploy/google-cloud.md)** —
   create the GCP project, enable Translation API, mint an API key
   restricted to that API.
3. **[docs/deploy/vps.md](docs/deploy/vps.md)** — VPS prep, first
   deploy, updates, log inspection, backup/restore, troubleshooting.

---

## Configuration reference

All settings live in `.env`. See `.env.example` for the full list with
inline comments. The required-to-boot subset:

| Variable | Purpose |
|---|---|
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application ID from the same portal |
| `OWNER_DISCORD_ID` | Your own Discord user snowflake — gates `/friends`, `/access`, `/settings show` |
| `GOOGLE_TRANSLATE_API_KEY` | API key from GCP Console with Cloud Translation scope |

The most useful optional ones:

| Variable | Default | Notes |
|---|---|---|
| `GOOGLE_MONTHLY_CHAR_LIMIT` | `500000` | Local hard-stop; matches GCP's free monthly credit |
| `DEFAULT_TARGET_LANGUAGE` | `en` | Fallback target when no per-user preference and locale doesn't map |
| `CACHE_STORE_SOURCE_TEXT` | `false` | Default is **hash-only** caching. Flip to `true` only for debugging |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `SKIP_COMMAND_REGISTRATION` | `false` | Skip the Discord PUT during fast dev iteration |

The bot never logs message content. Cached entries store a SHA-256
hash of the input text by default, never the text itself.

---

## Commands

| Command | Who | What |
|---|---|---|
| `Apps → Translate` (right-click a message) | owner + allowlisted friends | Ephemeral translation panel |
| `/settings show` | owner | Effective config snapshot + friend count |
| `/friends add user_id:<snowflake>` | owner | Add a friend to the allowlist |
| `/friends remove user_id:<snowflake>` | owner | Remove a friend |
| `/friends list` | owner | List allowlisted friends |
| `/access server enable user_id:<snowflake>` | owner | Allow a friend to use the bot inside guilds (default = DMs only) |
| `/access server disable user_id:<snowflake>` | owner | Restrict a friend back to DM-only |
| `/quota status` | owner + friends | Current provider usage, monthly limit, cache size |

The translate panel collapses by default. Click **⚙ Change language**
to reveal Source / Target / Swap / Save target / Hide. Toggling is
free — only Source/Target/Swap re-translate, and they hit the cache
on repeats.

---

## Operations

### View logs

```bash
docker compose logs -f bot       # follow
docker compose logs --tail=200 bot
```

Structured JSON, one event per line. Each event has `ts`, `level`,
`msg`, plus context (`userId`, `provider`, `billed`, etc). No message
bodies.

### Restart the bot

```bash
docker compose restart bot       # quick restart, keeps the volume
```

### Update the bot

```bash
git pull
docker compose up --build -d     # rebuild image, restart with new code
```

The bot re-registers Discord commands on every boot — that's
idempotent. Your friend allowlist, saved target preferences, quota
counters, and cache survive across rebuilds (they live in the
`bot-data` named volume).

### Back up SQLite

```bash
./scripts/backup-sqlite.sh ./backups/dt-$(date +%Y%m%d).tgz
```

Creates a tar.gz of the named volume's contents. Run from cron daily
if you care about the friend allowlist + saved preferences. The
translation cache is rebuildable from re-translates so it's
backup-optional.

### Restore SQLite

```bash
docker compose down
./scripts/restore-sqlite.sh ./backups/dt-20260601.tgz
docker compose up -d
```

The bot validates the schema on boot (`CREATE TABLE IF NOT EXISTS`),
so a restored older snapshot is forward-compatible across normal
schema-stable updates.

---

## Architecture

Single-process Node.js bot. Layers (`src/`):

```
bot/         Discord gateway client
commands/    Slash + context-menu command JSON, registration
interactions/ Handlers: translate, friends, access, settings, quota, panel
services/    Translation orchestrator (cache → quota → provider → render)
providers/   TranslationProvider interface + Google adapter
text/        Placeholder protect/rehydrate + render to Discord limits
sessions/    In-memory translation-session store with TTL
db/          better-sqlite3 connection, migrations, repositories
access.ts    Owner/friend access decisions
config.ts    Zod-validated env
logger.ts    Structured JSON logger
index.ts     Composition root
```

Full design rationale, V1/V2 boundaries, security review, and milestone
breakdown live in
[docs/plans/discord-translation-bot.md](docs/plans/discord-translation-bot.md).

---

## Working in this repo (agents only)

This repo is worked on one agent at a time (Claude Code or Codex CLI).
Project state lives in `docs/agent/`; vendor-local agent memory is
advisory only. Session verbs: `start session`, `checkpoint`,
`save session`, `publish session`. Full protocol:
[docs/agent/PROTOCOL.md](docs/agent/PROTOCOL.md).

---

## License

Personal project. No license granted.
