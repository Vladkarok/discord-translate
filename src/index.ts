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

const main = async (): Promise<void> => {
  const config = loadConfig();
  setLogLevel(config.LOG_LEVEL);

  log('info', 'bot.starting', { version: '0.5.0', node: process.version });

  const db = openDatabase(config.DATABASE_PATH);
  runMigrations(db);
  const users = createUsersRepository(db);
  const ownerPrefs = createOwnerPrefsRepository(db);
  const usage = createProviderUsageRepository(db);
  const cache = createTranslationCacheRepository(db);

  const pruned = cache.prune(CACHE_RETENTION_DAYS);
  if (pruned > 0) {
    log('info', 'cache.pruned', { rows: pruned, retentionDays: CACHE_RETENTION_DAYS });
  }

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
