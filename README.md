# discord-translate

Personal Discord translation bot. The owner and a small allowlist of
friends select a Discord message, hit `Apps -> Translate`, and get an
ephemeral translation visible only to them — with controls to override
source/target language and save a default.

**Status:** pre-implementation. Plan committed; no runtime code yet.

## Stack (v1)

- **Language:** TypeScript on Node.js
- **Discord lib:** `discord.js` v14, user-installable app with a message
  context-menu command
- **Translation provider:** DeepL Free (single provider in v1; provider
  interface left in place to allow Google later)
- **Storage:** SQLite via `better-sqlite3` on a Docker volume
- **Deploy:** single container via Docker Compose on a VPS

See `docs/plans/discord-translation-bot.md` for the full plan, milestone
breakdown (M0–M6), data model, quota/cache design, and security notes.

## Scope and non-goals (v1)

- Three users total (owner + 2 friends). No multi-tenant logic.
- DM-only by default. Server usage is an explicit per-friend opt-in.
- Text messages only. No OCR, no images, no attachments.
- Free-tier providers only — hard local quota stop before paid usage.
- No web dashboard, no public bot listing.

## Repository layout

```
.
├── AGENTS.md                # agent contract (Claude Code + Codex CLI)
├── CLAUDE.md                # Claude Code adapter
├── README.md                # this file
├── .codex/notes.md          # Codex CLI adapter
├── docs/
│   ├── plans/
│   │   └── discord-translation-bot.md   # product/architecture plan
│   └── agent/
│       ├── PROTOCOL.md      # session-verb operating manual
│       ├── STATE.md         # current project state
│       ├── JOURNAL.md       # append-only history
│       ├── DECISIONS.md     # one-line decision index
│       ├── sessions/        # per-session handoff files
│       ├── tasks/           # multi-session task tracking
│       └── scripts/         # drift-check, validate-memory, etc.
└── .github/workflows/
    └── deploy-staging.yml.example   # CI paths-ignore reference
```

Application code (TypeScript bot, Dockerfile, Compose) will land under
`src/`, `Dockerfile`, `docker-compose.yml`, and `data/` at Milestone 0.

## Working in this repo

This repo is worked on one agent at a time (Claude Code or Codex CLI).
Project state lives in `docs/agent/`; vendor-local agent memory is
advisory only. Four session verbs drive the workflow:

| Verb              | Effect                                           |
| ----------------- | ------------------------------------------------ |
| `start session`   | Restore context from repo memory + git           |
| `checkpoint`      | Flush in-memory plan to `STATE.md` (no commit)   |
| `save session`    | Durable handoff + local commit                   |
| `publish session` | Explicit `git push` (never automatic)            |

Full protocol: `docs/agent/PROTOCOL.md`.

## License

Personal project. No license granted.
