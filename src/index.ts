/**
 * discord-translate — entrypoint.
 *
 * Boot sequence (M3):
 *   1. Load + validate env (Zod; fails fast on missing vars).
 *   2. Open SQLite, run idempotent migrator.
 *   3. Build repositories (users, provider_usage) and provider adapter.
 *   4. Build translation service (orchestrator).
 *   5. Register global commands unless SKIP_COMMAND_REGISTRATION=true.
 *   6. Build discord.js Client (zero intents).
 *   7. Attach interaction router with all deps injected.
 *   8. Login. Discord gateway keep-alive owns the event loop.
 *   9. SIGTERM/SIGINT → client.destroy() → db.close() → exit.
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
import { createProviderUsageRepository } from './db/provider-usage.js';
import { createGoogleProvider } from './providers/google.js';
import { createTranslateService } from './services/translate.js';

const main = async (): Promise<void> => {
  const config = loadConfig();
  setLogLevel(config.LOG_LEVEL);

  log('info', 'bot.starting', { version: '0.3.0', node: process.version });

  const db = openDatabase(config.DATABASE_PATH);
  runMigrations(db);
  const users = createUsersRepository(db);
  const usage = createProviderUsageRepository(db);

  const provider = createGoogleProvider({ apiKey: config.GOOGLE_TRANSLATE_API_KEY });
  const translateService = createTranslateService({
    provider,
    usage,
    providerMonthlyLimit: config.GOOGLE_MONTHLY_CHAR_LIMIT,
  });

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
  attachInteractionHandler(client, buildInteractionRouter({ config, users, translateService }));

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
