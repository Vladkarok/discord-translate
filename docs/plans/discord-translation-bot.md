# Discord Translation Bot Implementation Plan

## Goal

Build a personal Discord translation app for the owner and a small group of
friends. The primary workflow is:

1. A user opens Discord in a DM, group DM, or an explicitly allowed server.
2. The user selects a text message and chooses `Apps -> Translate`.
3. The app replies with an ephemeral translation visible only to that user.
4. The response shows the detected source language, target language, original
   text, translated text, and controls for changing source/target language.

The first production version should use hosted translation APIs with free
tiers, not a self-hosted ML model. **DeepL Free is the only provider implemented
in v1.** A `TranslationProvider` interface is in place so a Google Cloud
Translation adapter can be added later without refactor; Google is deferred
indefinitely because for the 3-user audience DeepL Free (500K char/month) will
not be exhausted, and Google adds GCP project + billing + JSON-credential
complexity with a free-tier sunset after 12 months. Paid overflow is disabled.

## User Requirements

- Supported first languages: Ukrainian, French, English.
- Other languages should be possible later if the provider supports them.
- Default source language: auto-detected.
- Default target language:
  1. saved user preference, if present;
  2. Discord interaction locale, if it maps cleanly to a translation language;
  3. English fallback.
- User must be able to override both source and target language for a message.
- Translation quality matters more than avoiding third-party APIs.
- Public/free demo APIs are not acceptable for production use.
- DeepL and Google API keys are acceptable.
- Hard stop before paid usage. No paid overflow in v1.
- V1 supports text messages only. No image/OCR/attachment translation.
- The app runs on a VPS using Docker.
- VPS constraints: 4 CPU cores, 8 GB RAM, shared with other projects, no GPU.
- Usage pattern can be an active evening conversation, so interaction latency
  should be kept low and provider calls should not block Discord timeouts.
- Total audience: owner + 2 friends. Any abstraction priced for "scaling
  later" is YAGNI at this size and is dropped from v1.
- Friend access should be simple: owner allowlists a friend, friend installs
  the Discord app through the normal Discord install link, then uses it.
- Default friend scope: DMs only.
- Server usage: configurable and disabled by default.

## Non-Goals For V1

- No self-hosted translation model.
- No paid translation usage.
- No OCR or image translation.
- No web dashboard.
- No multi-tenant billing.
- No public bot listing.
- No complex user registration outside Discord.
- No automatic server-wide availability for friends unless explicitly enabled.

## Platform Assumptions To Verify

Before implementation, verify these in a throwaway Discord app:

- A user-installable app can expose a message context menu command in DMs.
- The command appears under the expected mobile and desktop `Apps` menu.
- Ephemeral responses work in the target DM and server contexts.
- The app receives enough message text from the interaction for translation.
- `interaction.locale` is populated for the invoking user and is stable enough
  to use as a default target hint.
- Message command registration works for the chosen install contexts.

Relevant documentation:

- Discord application commands:
  https://docs.discord.com/developers/interactions/application-commands
- Discord interaction responses:
  https://docs.discord.com/developers/interactions/receiving-and-responding
- Discord user-installable apps:
  https://docs.discord.com/developers/tutorials/developing-a-user-installable-app
- DeepL API docs:
  https://developers.deepl.com/docs
- Google Cloud Translation docs:
  https://cloud.google.com/translate/docs

## High-Level Architecture

Use one Docker Compose stack:

```text
discord-translate/
  src/
    bot/
    commands/
    interactions/
    providers/
    services/
    db/
  data/
    bot.sqlite
  Dockerfile
  docker-compose.yml
  .env.example
```

Runtime components:

- Discord bot process: TypeScript, Node.js, `discord.js`.
- Translation providers: DeepL adapter (v1). Provider interface in place
  for later Google adapter; not implemented in v1.
- Database: SQLite persisted on a Docker volume.
- Deployment: one container is enough for v1. No separate translation service.
- Container runs as non-root (use Node official image's `USER node`).

The app should be structured so the Discord layer does not know provider
details. All translation calls go through a provider interface and a
translation service.

## Technology Choices

### Language And Framework

Use TypeScript and `discord.js`.

Reasoning:

- Strong support for Discord app commands and interaction components.
- Good fit for message context menu commands, buttons, selects, and modals.
- Easier Discord API ergonomics than mixing a Python bot with Node examples.
- Translation providers are simple HTTP/API clients, so TypeScript is enough.

### Database

Use SQLite via `better-sqlite3`.

Reasoning:

- The bot is personal/small-group (3 users total).
- Single-process writes are sufficient; synchronous API simplifies the code.
- Easy Docker volume persistence.
- No extra database service to maintain on the VPS.

Implementation: a tiny startup migrator runs `CREATE TABLE IF NOT EXISTS`
statements idempotently on boot. No ORM — 4 tables and zero expected schema
churn make Drizzle/Prisma dead weight at this scale. If the schema ever grows
past ~10 tables or migration history becomes non-trivial, revisit.

### Translation Providers

v1 implements DeepL only. The `TranslationProvider` interface allows a Google
adapter later without refactor.

DeepL is the choice because quality is usually strong for English/French/
Ukrainian, the free tier (500K char/month) is clearly metered, and the API key
flow is simple (no GCP project/billing setup).

Google deferral notes (for the future adapter, when/if added):

- Google Cloud Translation free tier is 500K char/month for the first 12
  months on a new GCP project. After that, paid by default — so the local
  hard-stop guard and `ALLOW_PAID_OVERFLOW=false` become the only protection.
- Requires GCP project, billing-enabled account, service-account JSON
  credentials, and `GOOGLE_APPLICATION_CREDENTIALS` env wiring.

Paid overflow is disabled. Provider calls must be blocked locally before
exceeding configured monthly limits.

## Discord App Model

### Install Flow

Use Discord's native user-install flow:

1. Owner creates/configures the Discord app.
2. Friend opens the app install link.
3. Friend accepts the Discord permission/install prompt.
4. Friend can use `Apps -> Translate` if they are allowlisted.

There is no custom registration flow.

### Commands

Message context command:

- `Translate`
  - Input: selected Discord message.
  - Output: ephemeral translation UI.

Slash commands:

- `/settings target-language <language>`
  - Sets the invoking user's preferred target language.
- `/settings show`
  - Shows current user settings privately.
- `/friends add <user>`
  - Owner-only. Adds a Discord user ID to the allowlist.
- `/friends remove <user>`
  - Owner-only. Removes a Discord user ID from the allowlist.
- `/friends list`
  - Owner-only. Lists allowlisted users.
- `/access server enable <user>`
  - Owner-only. Allows a user to translate in server contexts.
- `/access server disable <user>`
  - Owner-only. Restricts a user back to DM-only.
- `/quota status`
  - Shows local quota accounting for the invoking user or owner view.

Consider later:

- `/language list`
- `/settings provider-order`
- `/access server allow-server <server>`
- `/access server deny-server <server>`

### Interaction Flow

On `Translate`:

1. **First line of the handler:** `interaction.deferReply({ flags:
   MessageFlags.Ephemeral })`. The 3-second Discord ack deadline must be met
   before any DB read or provider call. Easy to violate under refactor.
2. Validate invoking user is allowed.
3. Validate current context:
   - Owner: allowed in DMs and configured servers.
   - Friend: DMs only by default.
   - Friend in server: only if owner enabled server usage for that friend.
4. Extract message text.
5. Reject empty/non-text messages with a private explanation.
6. Resolve target language.
7. Translate with provider service.
8. Send or edit ephemeral response with result and controls.

**Discord gateway intents:** none privileged. Message context commands
deliver the target message in the interaction payload. Do **not** enable
`MessageContent` intent — it is not needed and broadens permission scope
unnecessarily.

Controls:

- `Source`
  - Opens a language select menu.
  - Includes `Auto` and common languages first.
- `Target`
  - Opens a language select menu.
- `Swap`
  - Swaps source and target when source is known.
  - Disabled if source is still `Auto` or unknown.
- `Save target`
  - Saves current target language as user default.

If detection is weak or missing:

1. Do not produce a misleading translation.
2. Reply ephemerally with original text and source-language selection.
3. After user selects source, translate.

### Ephemeral Message Format

Default result:

```text
French -> English
Provider: DeepL

Original:
<source text>

Translation:
<translated text>
```

For long messages:

- Show full translation.
- Trim original text in the main response if necessary.
- Include a note such as `Original trimmed for display`.
- Avoid leaking text into logs.

Discord message component limits should be handled explicitly. If the result is
too long for one message, split safely or use a compact response with a follow-up
ephemeral message.

## Access Control

Access is based on Discord user IDs.

Roles:

- owner
- friend

Default rules:

- Owner can use all configured contexts.
- Friend can use DMs and group DMs by default.
- Friend cannot use servers unless owner enables server usage for that friend.
- Unknown users are denied even if they install the app.

Owner identity comes from `OWNER_DISCORD_ID` in environment config — single
source of truth. The owner is not stored as a separate DB row; there is no
auditor besides the owner, so the "auditability" rationale doesn't apply at
v1 scale.

The allowlist is not a user registration system. It is quota protection.

## Quota And Cost Control

Hard stop before paid usage is a core requirement.

Store local monthly usage per provider:

- provider name
- billing month, e.g. `2026-05`
- characters used
- configured monthly free limit
- updated timestamp

Before any provider call:

1. Count input characters according to the provider's billing rules. Each
   adapter owns its own counting (DeepL bills source-text characters per
   call; if Google is later added, it bills per request including target
   conversion).
2. **Atomic check-and-increment** to avoid TOCTOU between concurrent
   interactions:
   ```sql
   UPDATE provider_usage
     SET characters_used = characters_used + :n,
         updated_at = :now
     WHERE provider = :p
       AND billing_month = :m
       AND characters_used + :n <= :limit;
   ```
   If 0 rows are affected, the call would overshoot — reject. Otherwise
   the call is "reserved" and may proceed. On provider failure, decrement.
3. Return an ephemeral quota message on reject.

After successful provider call:

1. Store provider, detected source, target, and character count.
2. (Usage already incremented atomically above.)

**Per-user daily cap.** In addition to the per-provider monthly cap, each
allowlisted user has a `daily_char_budget` (default e.g. 50K chars/day).
One friend pasting a long document cannot torch the shared monthly budget.

Configuration:

```text
DEEPL_MONTHLY_CHAR_LIMIT=500000
GOOGLE_MONTHLY_CHAR_LIMIT=500000
ALLOW_PAID_OVERFLOW=false
```

The exact provider account-side quota should still be configured in the vendor
console when possible. Local quota tracking is a safety guard, not a replacement
for provider billing limits.

## Translation Service Design

Provider interface:

```ts
export interface TranslateInput {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
}

export interface TranslateResult {
  provider: string;
  sourceLanguage: string | null;
  targetLanguage: string;
  translatedText: string;
  detected: boolean;
  confidence?: number;
  billedCharacters: number;
}

export interface TranslationProvider {
  name: string;
  // Static synchronous capability check — no I/O. Adapter owns its
  // language map.
  supports(input: TranslateInput): boolean;
  translate(input: TranslateInput): Promise<TranslateResult>;
}
```

Translation orchestration (v1 — single provider):

1. Normalize language codes from Discord/provider/UI into internal codes.
2. Check cache.
3. Atomic quota check-and-increment for the (only) provider.
4. Call provider.
5. On provider failure, decrement the quota reservation and surface a
   private error.
6. Store result.
7. Return result to interaction renderer.

The orchestrator does not yet implement fallback because there is only one
provider. The interface allows fallback to be added later without changing
adapters.

Provider failures should be classified:

- quota exceeded
- unsupported language
- authentication/config error
- transient network error
- provider error
- unknown error

Only safe fallback failures should try the next provider. Authentication errors
should surface to owner logs and not silently burn fallback quota unless the
failure is specific to provider availability.

## Language Handling

Internal language registry:

```text
en: English
fr: French
uk: Ukrainian
auto: Auto-detect
```

The registry should include provider-specific mapping:

- DeepL language codes
- Google language codes
- Discord locale mapping
- display labels
- whether source is supported
- whether target is supported

Start with English, French, Ukrainian as pinned common languages. Add a
provider-backed list later for broader support.

Target fallback:

1. saved user setting
2. Discord locale:
   - `en-*` -> English
   - `fr` -> French
   - `uk` -> Ukrainian
3. English

If source and target resolve to the same language, still allow the user to
override. The app can return a private prompt like: `Source and target both look
like English. Choose another target?`

## Caching

Cache translations to reduce cost and latency.

Cache key:

- normalized text hash
- source language or `auto`
- resolved detected source, if relevant
- target language
- provider

Cache value:

- translated text
- provider
- source language
- target language
- created timestamp

Recommended retention:

- 30 days by default.
- Owner can clear by deleting the SQLite volume or with a future command.

Privacy note:

- **Default: hash-only source caching.** The cache stores `source_hash` and
  the translated text. The raw source text is NOT stored. This is the v1
  privacy-preserving default (per self-review #7).
- An opt-in env flag (`CACHE_STORE_SOURCE_TEXT=true`) can enable raw source
  text storage for debugging, but it stays off in production.
- Avoid storing Discord message author names and unnecessary metadata.

## Configuration

`.env.example` should include:

```text
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_PUBLIC_KEY=
OWNER_DISCORD_ID=

DEEPL_API_KEY=
DEEPL_API_URL=https://api-free.deepl.com
DEEPL_MONTHLY_CHAR_LIMIT=500000

# Per-user daily character cap (quota protection against a single user
# burning the shared monthly budget):
DEFAULT_USER_DAILY_CHAR_LIMIT=50000

# Cache behaviour:
CACHE_STORE_SOURCE_TEXT=false   # default: hash-only privacy mode

ALLOW_PAID_OVERFLOW=false
DEFAULT_TARGET_LANGUAGE=en
DATABASE_PATH=/data/bot.sqlite
LOG_LEVEL=info

# Discord command registration runs on container start by default.
# Set to true during dev iteration to skip:
SKIP_COMMAND_REGISTRATION=false

# (Future Google adapter — not used in v1, left here as commented
# scaffolding for when/if it is implemented.)
# GOOGLE_PROJECT_ID=
# GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/google-credentials.json
# GOOGLE_MONTHLY_CHAR_LIMIT=500000
```

Do not commit real API keys.

## Docker And Deployment

Use one container in v1:

```text
services:
  bot:
    build: .
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./data:/data
      - ./secrets:/run/secrets:ro
```

Deployment steps:

1. Build image on VPS (no registry needed at this scale).
2. Create `.env` on VPS.
3. Start with `docker compose up -d`.
4. Check logs.
5. Discord command registration runs on container start automatically
   (idempotent; toggleable via `SKIP_COMMAND_REGISTRATION`).
6. Install app through Discord link.
7. Test in DM.

The bot should handle SIGTERM cleanly and close the database.

The Dockerfile must use the official Node image and switch to the
non-root `node` user after `npm install`/build.

## Logging And Privacy

Logs should include:

- interaction ID
- invoking user ID
- provider
- source/target language
- character count
- success/failure category
- latency

Logs should not include:

- full message text
- full translated text
- API keys
- Discord tokens

Debug mode can include short text previews if explicitly enabled, but default
production logs should avoid message content.

## Error Handling

User-facing errors must be private and actionable:

- not allowlisted
- server usage disabled
- message has no text
- message too long
- quota reached
- provider unavailable
- language unsupported
- source detection uncertain

Owner-facing logs should include enough detail to fix config/provider issues.

For provider outages:

- Try fallback provider if quota and language support allow it.
- If both fail, return a concise private error.
- Do not retry repeatedly inside one interaction in a way that causes long
  waits or duplicate billing.

## Security Considerations

- Store secrets only in `.env` or Docker secrets, never in git.
- Enforce owner-only commands by Discord user ID.
- Validate all interaction custom IDs to prevent cross-user button use.
- Component interactions should only be usable by the original invoking user.
- Avoid logging message content by default.
- Avoid exposing quota/admin commands to friends.
- Keep dependencies updated.
- Do not run the container as root if avoidable.

## Data Model Draft

Tables:

```text
users
  discord_user_id text primary key
  role text not null -- owner | friend
  target_language text null
  server_usage_enabled integer not null default 0
  daily_char_budget integer not null default 50000
  created_at text not null
  updated_at text not null

user_daily_usage
  discord_user_id text not null
  usage_date text not null  -- YYYY-MM-DD
  characters_used integer not null default 0
  updated_at text not null
  primary key (discord_user_id, usage_date)

provider_usage
  provider text not null
  billing_month text not null
  characters_used integer not null
  monthly_limit integer not null
  updated_at text not null
  primary key (provider, billing_month)

translation_cache
  cache_key text primary key
  provider text not null
  source_language text null
  target_language text not null
  source_hash text not null
  translated_text text not null
  created_at text not null
```

v1 defaults to hash-only caching (no `source_text` column). If
`CACHE_STORE_SOURCE_TEXT=true` is set, an optional `source_text` column is
populated; otherwise it stays null/absent. The migrator handles both
shapes idempotently.

Notes vs. earlier draft:

- `allowed_servers` table removed. Per-friend-per-server granularity is
  not a v1 requirement; `users.server_usage_enabled` boolean covers the
  actual feature ("can this friend use the bot in servers, yes/no?").
  If per-server allowlisting is ever needed, the table can be added then
  without migrating any existing data.
- Owner is **not** stored as a row. `OWNER_DISCORD_ID` env is the single
  source of truth.
- `provider_usage.monthly_limit` is denormalized into the row so the
  atomic check-and-increment query is self-contained (no env lookup
  inside SQL).

## Implementation Milestones

### Milestone 0 - Project Bootstrap

- Replace template README with project README.
- Customize `AGENTS.md` placeholders.
- Seed agent memory state.
- Create TypeScript package.
- Add lint/typecheck scripts.
- Add Dockerfile and Compose skeleton.
- Add `.env.example`.

Acceptance:

- `npm run typecheck` passes.
- `docker compose config` passes.
- No secrets are committed.

### Milestone 1 - Discord Command Skeleton

- Add Discord client startup.
- Register message context command `Translate`.
- Add simple ephemeral response: `Translation coming soon`.
- Add owner-only `/settings show`.
- Add command registration script.

Acceptance:

- App installs through Discord.
- `Apps -> Translate` appears in DM.
- Bot replies ephemerally.
- Unauthorized user receives private denial.

### Milestone 2 - Database And Access Control

- Add SQLite migrations.
- Seed owner from `OWNER_DISCORD_ID`.
- Implement allowlist.
- Implement `/friends add/remove/list`.
- Implement DM-only default for friends.
- Implement server usage enable/disable.

Acceptance:

- Owner can add a friend.
- Friend can translate in DM context.
- Friend is denied in server context by default.
- Owner can enable server usage for friend.

### Milestone 3 - DeepL Provider

- Add DeepL adapter.
- Add language mapping for English, French, Ukrainian.
- Implement atomic provider quota check-and-increment.
- Implement per-user daily char cap check.
- Implement text translation with auto-detect.
- Render source/target/provider in ephemeral response.

Acceptance:

- Ukrainian -> English works.
- French -> English works.
- English -> French works.
- Local provider quota increments atomically.
- Per-user daily cap blocks runaway usage.
- Calls stop before configured quota.

### Milestone 4 - Interactive Source/Target Controls

- Add `Source`, `Target`, `Swap`, `Save target` controls.
- Add language select menus.
- Prevent other users from using someone else's ephemeral controls.
- Re-run translation after override.

Acceptance:

- User can change source manually.
- User can change target manually.
- User can swap source/target after a successful translation.
- User can save default target language.

### Milestone 5 - Cache, Polish, Long Messages

- Add translation cache (hash-only by default).
- Add `/quota status`.
- Add message length limits.
- Add long-response handling.
- Add structured logs without message content.

Acceptance:

- Repeated translation can hit cache.
- Long messages are handled without Discord API errors.
- Quota status is accurate enough for free-tier protection.
- Logs show latency/provider/error category but not message body.

### Milestone 6 - VPS Deployment

- Deploy with Docker Compose.
- Configure restart policy and persistent volume.
- Document Discord Developer Portal setup.
- Document DeepL and Google setup.
- Run owner/friend DM tests.

Acceptance:

- Bot survives container restart.
- SQLite persists settings and quota.
- Owner and one friend can install and use the app.
- Server usage remains disabled unless explicitly enabled.

## Testing Strategy

Unit tests:

- language code mapping
- locale to target-language resolution
- access-control decisions
- atomic quota check-and-increment (including concurrent-call race)
- per-user daily cap logic
- cache key generation
- provider failure classification

Integration tests with mocked DeepL adapter:

- message context translation flow
- source override
- target override
- quota exceeded behavior (provider monthly and per-user daily)
- cache hit behavior

Manual Discord tests:

- desktop DM
- mobile DM
- group DM if desired
- server denied by default
- server allowed after owner command
- friend install flow
- unauthorized install attempt

Provider smoke tests:

- DeepL Ukrainian/French/English translations against the live free-tier
  API (manual; not in CI).
- Quota accounting after successful calls.

## Open Questions

- Should cache be global across all users or per-user? (Likely global —
  same source text translates the same regardless of who asks.)
- What exact maximum message length should v1 allow? (Discord caps message
  content at 4000 chars; ephemeral response body at 2000. Need to truncate
  the original-text echo, not the translation.)
- Should group DMs be treated as DMs or disabled until tested?

Resolved during v1 planning (see DECISIONS.md):

- ~~Source text storage vs. hash-only~~ → hash-only by default, env opt-in.
- ~~Per-friend per-server granularity~~ → single per-user boolean for v1.
- ~~Google Cloud Translation in v1~~ → deferred indefinitely; DeepL only.
- ~~Drizzle vs. better-sqlite3~~ → `better-sqlite3` + tiny startup migrator.
- ~~Runtime provider order config~~ → moot, single provider in v1.

## Self-Review

### Findings

1. **Quota hard-stop cannot rely only on local accounting.**
   Local character counting can drift from provider billing semantics or miss
   calls made outside this bot. The implementation should also configure vendor
   account-side limits/alerts where available and expose `/quota status` as
   approximate local protection, not authoritative billing truth.

2. **Discord user-install behavior must be proven early.**
   The product depends on the app appearing under `Apps -> Translate` in DMs
   after a user install. This should be milestone 1, before provider work, to
   avoid building translation logic around an unverified install/context setup.

3. **Google fallback may require more credential/billing complexity than DeepL.**
   Google Cloud often requires a project, credentials, and billing setup even
   when free monthly credit applies. The implementation should make Google
   optional and not block DeepL-only operation.

4. **Button/select state must be bound to the original invoking user.**
   Even though responses are ephemeral, component handlers should validate user
   ID and interaction state. This prevents accidental or future context leakage.

5. **Original text in the response is useful but can hit Discord limits.**
   The renderer needs explicit truncation/splitting rules. Otherwise long
   messages can fail at the Discord API layer after the provider call already
   consumed quota.

6. **Language detection confidence may not be consistently available.**
   Some providers may return a detected source language without a usable
   confidence score. The app should use practical heuristics: unsupported result,
   same source/target, provider ambiguity, or user override, rather than relying
   on a universal confidence field.

7. **Storing source text in SQLite is a privacy tradeoff.**
   It improves cache/debugging but stores private DM content on the VPS. The
   default should probably store translated text and source hash only, unless
   the owner explicitly enables source-text caching.

### Adjustments From Review

- Make Discord install/context validation the first real milestone.
- Make Google optional in config and implementation.
- Treat quota accounting as a local hard-stop guard plus vendor-side setup.
- Prefer source-text hashing in cache by default.
- Add explicit long-message rendering rules before provider calls are wired into
  the final interaction.

## Recommended First Build Slice

The first useful slice should be:

1. TypeScript Discord app starts in Docker (M0 + M1).
2. Message context command `Translate` appears in DMs.
3. Owner-only allowlist works.
4. `Translate` replies ephemerally with a placeholder.
5. DeepL translates English/French/Ukrainian text.
6. Result includes source, target, original preview, and translation.

Do not implement complex server access, interactive controls, or caching
until this slice proves the Discord UX and DeepL quality. Skip the
deferred Google adapter entirely until/unless a real need surfaces.
