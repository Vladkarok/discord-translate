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
complexity. (Note: Google's ~500K NMT chars/month is covered by a recurring
monthly credit, not a 12-month trial — the deferral is about setup overhead,
not free-tier expiry.) Paid overflow is disabled.

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
- No document translation or arbitrary attachment translation.
- No file-attachment delivery of long translation output (privacy/CDN
  concern — Discord CDN URLs are publicly reachable).
- No web dashboard.
- No multi-tenant billing.
- No public bot listing.
- No per-channel or per-server policy matrix.
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
- The global `Translate` command can be registered with `integration_types`
  including `USER_INSTALL` and `contexts` including `PRIVATE_CHANNEL`.
- `interaction.context` and `authorizing_integration_owners` are populated
  enough to distinguish user-installed DM/group-DM use from guild use.
- Component interactions preserve enough state to enforce "only the original
  invoking user can press these controls."

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
    text/
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

Decision comment:

- One process is enough because there are only three expected users and no
  independent scaling boundary. A separate API service, queue, worker, or
  Redis layer would add deployment/debugging cost without improving the core
  UX.
- Keep provider details out of the Discord handlers because provider choice is
  the most likely future change. The handler should know "translate this",
  not "call DeepL this way".
- Keep SQLite in a Docker volume because this is user/settings/quota state, not
  collaborative business data. PostgreSQL can be added later if concurrency or
  reporting needs become real.

## Technology Choices

### Language And Framework

Use TypeScript and `discord.js`.

Reasoning:

- Strong support for Discord app commands and interaction components.
- Good fit for message context menu commands, buttons, selects, and modals.
- Easier Discord API ergonomics than mixing a Python bot with Node examples.
- Translation providers are simple HTTP/API clients, so TypeScript is enough.

Decision comment:

- Prefer `discord.js` over Python for v1 because Discord interaction UX is the
  hard part, and the Node/TypeScript ecosystem is strong for application
  commands and components.
- Do not choose Python just for possible future local ML. Local translation is
  explicitly not v1, and optimizing for that now would make the first useful
  bot slower to ship.
- Do not use a lower-level Discord REST/webhook-only implementation unless VPS
  operations become a problem. The gateway client is simpler for an always-on
  personal bot.

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

Decision comment:

- Prefer `better-sqlite3` over an async SQLite wrapper because the bot is
  single-process and quota/settings writes are tiny. The synchronous API keeps
  quota code easier to reason about.
- Prefer hand-written SQL over an ORM because the schema is small and the
  important behavior is atomic SQL, not object mapping.
- Prefer startup `CREATE TABLE IF NOT EXISTS` over a migration framework until
  there is real schema history to preserve.

### Translation Providers

v1 implements DeepL only. The `TranslationProvider` interface allows a Google
adapter later without refactor.

DeepL is the choice because quality is usually strong for English/French/
Ukrainian, the free tier (500K char/month) is clearly metered, and the API key
flow is simple (no GCP project/billing setup).

Google deferral notes (for the future adapter, when/if added):

- Google Cloud Translation NMT is priced at $20 per million characters,
  offset by a recurring monthly credit that covers ~500K chars/month (not
  a 12-month trial — the credit is perpetual on standard pricing as of
  this writing). The local hard-stop guard and `ALLOW_PAID_OVERFLOW=false`
  remain the authoritative protection against overage.
- Requires GCP project, billing-enabled account, service-account JSON
  credentials, and `GOOGLE_APPLICATION_CREDENTIALS` env wiring.

Paid overflow is disabled. Provider calls must be blocked locally before
exceeding configured monthly limits.

Decision comment:

- Prefer DeepL over Google for v1 because setup is simpler and the required
  language set is small: English, French, Ukrainian. Google is useful later
  only if DeepL coverage or quality is insufficient in real use.
- Do not add Google as a "just in case" fallback in v1. It adds GCP project,
  billing, service-account secrets, and a second quota model before the core
  Discord UX is proven.
- Do not use OpenAI or a general LLM as the default translator. Dedicated MT is
  the safer default for predictable translation, quota accounting, and latency.
  A future LLM mode should be framed as tone/rewrite help, not the base engine.
- Do not self-host MT in v1. It improves incremental privacy after Discord but
  introduces model selection, CPU latency, language detection, updates, and
  quality tradeoffs that do not serve the first production goal.

## Discord App Model

### Install Flow

Use Discord's native user-install flow:

1. Owner creates/configures the Discord app.
2. Friend opens the app install link.
3. Friend accepts the Discord permission/install prompt.
4. Friend can use `Apps -> Translate` if they are allowlisted.

There is no custom registration flow.

Decision comment:

- Prefer Discord's native user-install flow over custom onboarding because the
  users are already Discord users and the audience is tiny.
- Keep allowlisting inside the bot instead of relying only on Discord install
  permissions. Installing the app is not the same as being allowed to spend the
  shared translation quota.
- Do not build a web dashboard or login flow for v1. Owner-only slash commands
  are enough for three users.

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

Decision comment:

- Use a message context command for translation because the selected message is
  the input. A slash command would force users to copy/paste text and would be
  worse on mobile.
- Keep slash commands for settings/admin operations because they do not target a
  specific message.
- Keep server access coarse in v1. Per-server or per-channel policy is a real
  feature only after server usage becomes common.

### Interaction Flow

On `Translate`:

1. **First line of the handler:** `interaction.deferReply({ flags:
   MessageFlags.Ephemeral })`. The 3-second Discord ack deadline must be met
   before any DB read or provider call. Easy to violate under refactor.
2. Validate invoking user is allowed.
3. Validate current context:
   - Prefer Discord's explicit `interaction.context` and
     `authorizing_integration_owners` metadata over heuristics like "guild ID
     present".
   - Owner: allowed in DMs and configured servers.
   - Friend: DMs only by default.
   - Friend in server: only if owner enabled server usage for that friend.
4. Extract message text and protect non-translatable spans.
5. Reject empty/non-text messages with a private explanation.
6. Resolve target language.
7. Translate with provider service.
8. Edit the original ephemeral response with result and controls.

Interaction response rule:

- Defer once immediately, then edit the original ephemeral response.
- Re-render the same original response for source/target overrides whenever
  practical.
- Avoid follow-up messages as the normal path. User-installed apps have a
  small follow-up budget, and follow-ups make the UX noisier than editing the
  current translation panel.

Decision comment:

- Defer immediately because provider calls, database reads, and cold network
  paths are all slower than Discord's interaction acknowledgement deadline.
- Edit the original ephemeral response because it keeps source/target override
  state in one place and avoids exhausting the follow-up message budget.
- Do not reply publicly in channels. Translation is often private, especially
  in DMs and small conversations.

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

### Interactive State Storage

Component interactions (Source/Target/Swap/Save target) cannot rebuild the
original translation context from Discord alone:

- `custom_id` is capped at 100 chars — too small for protected source text
  or any meaningful payload beyond an opaque session ID.
- On a component interaction, `interaction.message` is the bot's ephemeral
  response, not the original target message; re-fetching the target by ID
  may not be possible from a user-installed app's permission scope.
- The persistent `translation_cache` is hash-only by default and intentionally
  cannot reconstruct source text.

Solution: a short-lived **in-memory** session store keyed by an opaque
`sessionId` embedded in component `custom_id`s.

```ts
interface TranslationSession {
  userId: string;                  // bind to original invoking user
  protectedSource: string;         // post-placeholder-replacement text
  detectedSource: string | null;
  currentSource: string;           // 'auto' or language code
  currentTarget: string;
  expiresAt: number;               // epoch ms; TTL 15–30 min
}
// Map<string, TranslationSession> with a periodic sweep.
```

Why in-memory rather than a `translation_sessions` SQLite table:

- Single-process bot, 3 users — concurrency is trivial; no cross-process
  coordination is needed.
- Failure mode of a container restart mid-conversation is acceptable: the
  user re-invokes `Translate`. If the same text+target was already
  translated, the persistent hash-only cache makes the re-invocation
  effectively free.
- Keeps the no-source-text-on-disk discipline intact. Transient UI state
  is not persistent translation history; this is the distinction that
  matters.

Promote to a SQLite `translation_sessions` table (same schema, plus a TTL
sweep) **only** if observation shows users routinely losing in-flight
controls across restarts. Until then, in-memory is the right answer.

### Message Text And Formatting Protection

V1 translates selected message text. It does not translate attachments,
images, files, or OCR output.

Before sending text to a provider, split the message into translatable spans
and protected spans. Preserve these spans without translation:

- fenced code blocks
- inline code
- URLs
- raw Discord mentions (`<@...>`, `<#...>`, `<@&...>`)
- custom emoji tokens (`<:name:id>`, `<a:name:id>`)
- attachment URLs

Implementation shape:

1. Parse message content into spans.
2. Replace protected spans with stable placeholders.
3. Translate the protected text.
4. Verify every placeholder survived exactly once in the provider response.
5. Rehydrate placeholders into the translated result.
6. Render with `allowed_mentions: { parse: [] }` so translated output cannot
   ping users or roles.

If placeholder verification fails, do not render corrupted Discord syntax.
Return a private error or a conservative fallback rendering that keeps
protected spans out of the translated body.

Text-bearing embeds are not required for the first useful slice. They are a
reasonable V1.x/V2 addition after the plain message path is stable.

Decision comment:

- Protect code, URLs, mentions, and emoji before translation because providers
  are optimized for language, not Discord syntax. This also prevents accidental
  pings in translated output.
- Do not support attachments or OCR in v1. Those change privacy, billing,
  latency, and UI complexity enough to deserve a separate feature pass.

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

Discord message and component limits must be handled explicitly before the
provider call is wired into the final interaction. Bot message `content` is
capped at 2000 chars; embed `description` at 4096; total embed payload at
6000. Design the renderer around content=2000 and move the translation body
into an embed when it exceeds that. If even the embed cap is exceeded, emit
a compact response that contains the full translation and notes that the
original-text echo was trimmed. **Do not** use a file attachment to deliver
long translations in v1 — attachments change the privacy/retention story
(Discord CDN caches them with publicly reachable URLs). Do not spend the
limited follow-up message budget on length overflow.

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

Decision comment:

- Use Discord user IDs as the access key because they are stable enough for
  this private bot and already present in interactions.
- Keep owner identity in `OWNER_DISCORD_ID` because there is one owner and no
  independent auditor. Storing owner as a database row would create a second
  source of truth.
- Use a single `server_usage_enabled` boolean because v1 only needs "can this
  friend use servers at all?" Finer policy should wait for real server use.

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
   the call is "reserved" and may proceed. Refund rules are asymmetric;
   see "Reservation refund rules" below — do not blindly decrement on
   every failure.
3. Return an ephemeral quota message on reject.

After successful provider call:

1. Store provider, detected source, target, and character count.
2. (Usage already incremented atomically above.)

**No default daily cap.** For a 3-person bot, usage can be bursty: one active
day may involve a lot of translation, while another day may involve almost
none. A fixed per-user daily cap is likely to block legitimate use on the
active day and add little protection on quiet days. The provider monthly quota
is the actual hard stop for v1.

Optional future throttle:

- If real abuse/noise appears, add a per-user daily or rolling-window cap as a
  V1.x feature.
- Keep it disabled by default and configurable per user.
- If added, reserve provider monthly quota and per-user throttle in one
  `db.transaction(...)` so they succeed or fail together.

```ts
const reserveProviderQuota = db.transaction((p, month, n) => {
  const a = stmtProviderUpdate.run({ p, month, n /*, limit */ });
  if (a.changes === 0) throw new QuotaExceeded("provider");
});
```

The transaction wrapper is still useful even with one UPDATE because it keeps
the implementation ready for future quota tables and gives one place for
reservation/refund logic.

**Reservation refund rules (asymmetric).** DeepL may have already metered
characters on some failures. Refund the reservation **only** when we know the
call did not bill:

- **Refund safe:** local validation rejection before HTTP send; unsupported
  language detected before send; authentication/config error (401/403)
  before translation; explicit 4xx where the response indicates the request
  was rejected unprocessed.
- **Keep the reservation:** network timeout after send; 5xx response; any
  post-send error where DeepL's billing state is ambiguous. Accept small
  upward drift in favor of fail-closed behavior.
- **Manual reconciliation:** a future `/quota status` extension or a small
  periodic job can compare local accounting with the DeepL dashboard. In
  v1 the dashboard is the source of truth for billing; local accounting
  is only the hard local stop.

Configuration:

```text
DEEPL_MONTHLY_CHAR_LIMIT=500000
ALLOW_PAID_OVERFLOW=false
```

The exact provider account-side quota should still be configured in the vendor
console when possible. Local quota tracking is a safety guard, not a replacement
for provider billing limits.

Decision comment:

- Reserve quota before provider calls because the bot must fail closed before
  paid usage, not after the vendor has already billed characters.
- Use atomic SQL instead of check-then-increment code because concurrent
  interactions can otherwise overshoot the local cap.
- Do not enable a per-user daily cap by default because active conversation is
  naturally bursty. The monthly provider cap is the hard stop; per-user
  throttles can be added later if real abuse appears.
- Still configure provider-side limits because local accounting can drift if
  calls happen outside the bot or the provider's billing semantics change.

## Translation Service Design

Provider interface:

```ts
export interface TranslateInput {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  context?: string;
  qualityPreference?: "latency" | "quality";
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
2. Protect non-translatable spans and derive the normalized cache input.
3. Check cache.
4. Atomic quota check-and-increment for the (only) provider.
5. Call provider.
6. On provider failure, apply reservation refund rules; refund only when the
   request is definitely unbilled.
7. Rehydrate protected spans.
8. Store result.
9. Return result to interaction renderer.

The orchestrator does not yet implement fallback because there is only one
provider. The interface allows fallback to be added later without changing
adapters.

Decision comment:

- Keep the provider interface now because it is cheap and protects the Discord
  layer from provider-specific APIs.
- Do not implement fallback orchestration until there is a second real
  provider. Fallback code without a real adapter is untested branching.
- Keep `supports()` synchronous so provider routing cannot introduce network
  calls before quota checks or interaction acknowledgement.

DeepL-specific v1 note:

- DeepL's `context` parameter is useful for short ambiguous chat messages and
  is not billed as translated text. Do not depend on fetching previous Discord
  messages for v1. If safe context is already available from the interaction
  or a later verified flow, pass it through `TranslateInput.context`.

Provider failures should be classified:

- quota exceeded
- unsupported language
- authentication/config error
- transient network error
- provider error
- unknown error

Future fallback rule: only safe fallback failures should try the next provider.
Authentication errors should surface to owner logs and not silently burn
fallback quota unless the failure is specific to provider availability.

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

DeepL adapter mapping:

- Internal codes stay lowercase (`en`, `fr`, `uk`, `auto`).
- For auto-detection, omit DeepL `source_lang`; DeepL requires
  `target_lang`.
- Manual source mapping:
  - `en` -> `EN`
  - `fr` -> `FR`
  - `uk` -> `UK`
- Target mapping:
  - `en` -> `EN-US` by default
  - `fr` -> `FR`
  - `uk` -> `UK`
- `DEFAULT_ENGLISH_VARIANT` may switch the target mapping to `EN-GB` if the
  owner prefers British English. Avoid generic DeepL target `EN` unless there
  is a specific compatibility reason; DeepL recommends choosing a regional
  English target variant.
- Do not use regional variants as `source_lang`; DeepL variants are target
  language choices.

Target fallback:

1. saved user setting
2. Discord locale:
   - `en-US` -> English (`EN-US`)
   - other `en-*` -> English (`DEFAULT_ENGLISH_VARIANT`)
   - `fr` -> French
   - `uk` -> Ukrainian
3. English

If source and target resolve to the same language, still allow the user to
override. The app can return a private prompt like: `Source and target both look
like English. Choose another target?`

DeepL billing note: same-language translation requests still count toward
billing, so avoid sending known same-language source/target pairs unless the
user explicitly confirms or changes one side.

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

Decision comment:

- Cache translated output because repeated chat phrases are common and cache
  hits reduce cost and latency.
- Do not store raw source text by default because Discord messages may be
  private. A source hash is enough to find repeat translations without turning
  SQLite into a DM archive.
- Use a global cache by default unless abuse appears. For the same normalized
  text/source/target/provider tuple, the result is not user-specific in v1.

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
DEFAULT_ENGLISH_VARIANT=en-US

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

Decision comment:

- Prefer Docker Compose on the existing VPS because it matches the deployment
  environment and keeps persistence simple.
- Do not use serverless HTTP interactions for v1. They are viable, but they
  add signature verification, statelessness, cold starts, and different
  operational failure modes for no clear benefit at three users.
- Do not push an image registry into the first deployment unless VPS builds are
  actually painful. Building locally on the VPS is sufficient at this scale.

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

- v1 has no fallback provider. Return a concise private error.
- If a future V2 fallback provider exists, try it only when quota and language
  support allow it.
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
  created_at text not null
  updated_at text not null

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
  source_text text null -- populated only when CACHE_STORE_SOURCE_TEXT=true
  translated_text text not null
  created_at text not null
```

v1 defaults to hash-only caching. `source_text` exists only to keep the schema
simple; it stays null unless `CACHE_STORE_SOURCE_TEXT=true` is set.

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

## Post-V1 Evolution

V1 is a stable personal bot, not a disposable prototype. "V2" should mean
"new capability class after V1 is useful in daily conversation", not automatic
scope expansion. If V1 solves the real need, V2 can stay unbuilt.

Decision comment:

- The label "v1" exists to keep the first release disciplined, not to promise a
  larger product. Future work should be pulled by observed usage.
- V1.x is for low-risk polish that preserves the architecture. V2 is for new
  capability classes: new providers, local MT, documents/OCR, or richer access
  policy.

### V1 Definition

V1 is complete when:

- owner + allowlisted friends can use `Apps -> Translate` in DMs/group DMs
- the app uses DeepL only, with hard local quota stops
- text messages translate between English, French, and Ukrainian
- source/target overrides and saved default target language work
- logs avoid message content by default
- hash-only cache, quota status, and long-message handling are in place
- the bot runs on the VPS with persistent SQLite storage

### V1.x Polish Candidates

Small additions that should not change the architecture:

- text-bearing embed translation after plain message translation is stable
- optional small `.txt` / `.md` attachment translation with explicit consent
- DeepL context for short messages if context can be obtained without broader
  Discord permissions or extra privacy exposure
- optional per-user daily or rolling-window throttle if real abuse/noise
  appears; disabled by default
- provider-side usage polling to compare local quota accounting with DeepL
- backup/restore notes for the SQLite volume

### V2 Candidates

Only promote these when a real need appears:

- **Provider expansion:** Google Cloud Translation NMT as a fallback if DeepL
  lacks coverage or quality for a language pair actually used. Google remains
  optional because it adds GCP project, billing, and credential complexity.
- **Quality modes:** an optional "rewrite/tone" path using an LLM for cases
  where preserving social tone or formatting matters more than deterministic
  machine translation. This is not the default translator.
- **Local privacy backend:** optional self-hosted MT, likely M2M100/NLLB via
  CTranslate2, for conversations where avoiding an extra cloud provider matters
  more than quality/latency simplicity. Keep it as a separate backend, not a
  rewrite of the Discord bot.
- **Richer content:** document translation, OCR, and larger attachment flows.
  These require explicit consent and separate privacy/billing treatment.
- **Richer access model:** per-server or per-channel policy tables only if the
  single `server_usage_enabled` boolean becomes inadequate in real use.
- **Broader operations:** health command, backup automation, key rotation
  runbook, dependency update cadence, and provider-side quota reconciliation.

Explicit V2 non-goal unless the product changes: public bot listing,
multi-tenant billing, or broad server moderation features.

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
  - Global command uses user-install support and `PRIVATE_CHANNEL` context
    for the first verification path.
  - Guild/server context can be present in code only after the DM path is
    verified.
- Add simple ephemeral response: `Translation coming soon`.
- Add owner-only `/settings show`.
- Add command registration script.
- Use immediate defer + edit-original response path, even for the placeholder.

Acceptance:

- App installs through Discord.
- `Apps -> Translate` appears in DM.
- Registration payload uses the intended `integration_types` and `contexts`.
- Bot replies ephemerally.
- Unauthorized user receives private denial.
- The handler records/verifies `interaction.context` and
  `authorizing_integration_owners` during manual testing.

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
- Add message formatting protection for code spans, URLs, mentions, emoji
  tokens, and attachment URLs.
- Implement atomic provider quota check-and-increment.
- Implement text translation with auto-detect.
- Render source/target/provider in ephemeral response.

Acceptance:

- Ukrainian -> English works.
- French -> English works.
- English -> French works.
- Local provider quota increments atomically.
- Calls stop before configured quota.
- Mentions/code/URLs are preserved and never accidentally ping.
- Placeholder corruption is detected before rendering translated output.

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
- Keep the normal interaction loop on edit-original response, not follow-up
  message chains.

Acceptance:

- Repeated translation can hit cache.
- Long messages are handled without Discord API errors.
- Quota status is accurate enough for free-tier protection.
- Logs show latency/provider/error category but not message body.

### Milestone 6 - VPS Deployment

- Deploy with Docker Compose.
- Configure restart policy and persistent volume.
- Document Discord Developer Portal setup.
- Document DeepL setup, provider-side usage limits, and notes for future
  Google setup if V2 needs it.
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
- Discord install/context interpretation from `interaction.context` and
  `authorizing_integration_owners`
- formatting protection and placeholder rehydration
- atomic quota check-and-increment (including concurrent-call race)
- cache key generation
- long-message rendering decisions
- provider failure classification

Integration tests with mocked DeepL adapter:

- message context translation flow
- immediate defer + edit-original flow
- source override
- target override
- foreign-user component rejection
- quota exceeded behavior (provider monthly)
- cache hit behavior
- rate-limit/provider failure behavior

Manual Discord tests:

- desktop DM
- mobile DM
- group DM
- server denied by default
- server allowed after owner command
- friend install flow
- unauthorized install attempt
- someone else attempts to use another user's controls

Provider smoke tests:

- DeepL Ukrainian/French/English translations against the live free-tier
  API (manual; not in CI).
- Quota accounting after successful calls.

## Open Questions

- Should cache be global across all users or per-user? (Likely global —
  same source text translates the same regardless of who asks.)
- What exact maximum message length should v1 allow? Discord bot message
  `content` is capped at 2000 chars (the 4000-char limit applies to Nitro
  client composition, not the bot API). Embed `description` is 4096 chars;
  total embed payload is 6000. Design the renderer around content=2000 with
  the embed as the long-form path. Truncate the original-text echo, not the
  translation.
- Should group DMs be treated as DMs or disabled until tested?
- Should DeepL context be enabled at all in v1, given that fetching surrounding
  Discord messages may broaden permissions/privacy exposure? Default: no.

Resolved during v1 planning (see DECISIONS.md):

- ~~Source text storage vs. hash-only~~ → hash-only by default, env opt-in.
- ~~Per-friend per-server granularity~~ → single per-user boolean for v1.
- ~~Google Cloud Translation in v1~~ → deferred indefinitely; DeepL only.
- ~~Drizzle vs. better-sqlite3~~ → `better-sqlite3` + tiny startup migrator.
- ~~Runtime provider order config~~ → moot, single provider in v1.
- ~~Per-user daily char cap by default~~ → disabled/omitted in v1; usage is
  bursty, so provider monthly quota is the hard stop.

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
- Use edit-original response as the normal interaction update path; avoid
  follow-up chains.
- Add formatting protection before provider calls can ship.
- Treat V2 as optional evolution after V1 proves daily value, not as automatic
  scope expansion.

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
