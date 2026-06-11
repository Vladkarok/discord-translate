/**
 * discord-translate — entrypoint.
 *
 * Boot sequence (M5):
 *   1. Load + validate env (Zod; fails fast on missing vars).
 *   2. Open SQLite, run idempotent migrator.
 *   3. Build repositories (users, owner_prefs, provider_usage,
 *      translation_cache), provider adapter, translation service,
 *      in-memory session store.
 *   4. Prune cache entries older than 30 days.
 *   5. Register global commands unless SKIP_COMMAND_REGISTRATION=true.
 *   6. Build discord.js Client (zero intents).
 *   7. Attach interaction router with all deps injected.
 *   8. Login. Discord gateway keep-alive owns the event loop.
 *   9. SIGTERM/SIGINT → client.destroy() → sessions.stop() →
 *      db.close() → exit.
 *
 * Run locally with:
 *   node --env-file=.env --enable-source-maps dist/index.js
 */
import { readFileSync } from 'node:fs';
import { loadConfig } from './config.js';
import { log, setLogLevel } from './logger.js';
import { COMMAND_DEFINITIONS } from './commands/definitions.js';
import { registerGlobalCommands } from './commands/register.js';
import { attachInteractionHandler, attachLifecycleLogging, createClient } from './bot/client.js';
import { buildInteractionRouter } from './interactions/router.js';
import { closeDatabase, openDatabase } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { createUsersRepository } from './db/users.js';
import { createOwnerPrefsRepository } from './db/owner-prefs.js';
import { createProviderUsageRepository } from './db/provider-usage.js';
import { createTranslationCacheRepository } from './db/cache.js';
import { createGoogleProvider } from './providers/google.js';
import { createTranslateService } from './services/translate.js';
import { createSessionStore } from './sessions/store.js';

const CACHE_RETENTION_DAYS = 30;
const CACHE_PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000; // re-prune daily
const SHUTDOWN_WATCHDOG_MS = 5_000;

// Resolves to <repo-or-image-root>/package.json from both src/ and dist/.
const readVersion = (): string => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version?: string;
  };
  return pkg.version ?? 'unknown';
};

const main = async (): Promise<void> => {
  const config = loadConfig();
  setLogLevel(config.LOG_LEVEL);

  log('info', 'bot.starting', { version: readVersion(), node: process.version });

  const db = openDatabase(config.DATABASE_PATH);
  runMigrations(db);
  const users = createUsersRepository(db);
  const ownerPrefs = createOwnerPrefsRepository(db);
  const usage = createProviderUsageRepository(db);
  const cache = createTranslationCacheRepository(db);

  const pruneCache = (): void => {
    const pruned = cache.prune(CACHE_RETENTION_DAYS);
    if (pruned > 0) {
      log('info', 'cache.pruned', { rows: pruned, retentionDays: CACHE_RETENTION_DAYS });
    }
  };
  pruneCache();
  // Boot-only pruning makes retention best-effort on a long-lived
  // container; a daily sweep keeps the 30-day promise honest.
  const pruneTimer = setInterval(pruneCache, CACHE_PRUNE_INTERVAL_MS);
  pruneTimer.unref();

  const provider = createGoogleProvider({ apiKey: config.GOOGLE_TRANSLATE_API_KEY });
  const translateService = createTranslateService({
    provider,
    usage,
    cache,
    providerMonthlyLimit: config.GOOGLE_MONTHLY_CHAR_LIMIT,
    storeSourceText: config.CACHE_STORE_SOURCE_TEXT,
  });

  const sessions = createSessionStore();

  if (config.SKIP_COMMAND_REGISTRATION) {
    log('warn', 'commands.skipped', { reason: 'SKIP_COMMAND_REGISTRATION=true' });
  } else {
    await registerGlobalCommands({
      token: config.DISCORD_TOKEN,
      clientId: config.DISCORD_CLIENT_ID,
      commands: COMMAND_DEFINITIONS,
    });
  }

  const client = createClient();
  attachLifecycleLogging(client);
  attachInteractionHandler(
    client,
    buildInteractionRouter({
      config,
      users,
      ownerPrefs,
      usage,
      cache,
      translateService,
      sessions,
    }),
  );

  const shutdown = (signal: NodeJS.Signals): void => {
    log('info', 'bot.shutdown', { signal });
    // If client.destroy() hangs, don't wait for Docker's SIGKILL.
    const watchdog = setTimeout(() => {
      log('error', 'bot.shutdown_forced', { afterMs: SHUTDOWN_WATCHDOG_MS });
      process.exit(1);
    }, SHUTDOWN_WATCHDOG_MS);
    watchdog.unref();
    clearInterval(pruneTimer);
    client
      .destroy()
      .catch((err: unknown) => {
        log('error', 'client.destroy_failed', {
          err: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        sessions.stop();
        closeDatabase(db);
        process.exit(0);
      });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await client.login(config.DISCORD_TOKEN);
  log('info', 'bot.ready');
};

main().catch((err: unknown) => {
  log('error', 'bot.fatal', { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
