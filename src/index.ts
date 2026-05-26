/**
 * discord-translate — entrypoint.
 *
 * Milestones: see docs/plans/discord-translation-bot.md.
 * This is the M0 skeleton — no Discord client, no DB, no provider yet.
 *
 * Run locally with:
 *   node --env-file=.env --enable-source-maps dist/index.js
 */

interface LogPayload {
  readonly ts: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly msg: string;
  readonly [key: string]: unknown;
}

const log = (
  level: LogPayload['level'],
  msg: string,
  extra: Record<string, unknown> = {},
): void => {
  const payload: LogPayload = { ts: new Date().toISOString(), level, msg, ...extra };
  // Structured logs land here in M5. For now: one JSON line per event.
  process.stdout.write(JSON.stringify(payload) + '\n');
};

const main = (): void => {
  log('info', 'bot.starting', { version: '0.1.0', node: process.version });

  // Keep the event loop alive until a signal arrives. M1 replaces this
  // with the discord.js gateway client, which owns its own keep-alive.
  const heartbeat = setInterval(() => {
    // M5: emit periodic health/quota snapshot here.
  }, 60_000);

  const shutdown = (signal: NodeJS.Signals): void => {
    log('info', 'bot.shutdown', { signal });
    clearInterval(heartbeat);
    // M2+: close the better-sqlite3 handle here before exiting.
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  log('info', 'bot.ready');
};

try {
  main();
} catch (err: unknown) {
  log('error', 'bot.fatal', { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
}
