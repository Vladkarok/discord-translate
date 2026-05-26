/**
 * Structured JSON logger. One line per event on stdout. M5 may swap this
 * for pino/winston; the public API (`log(level, msg, extra?)`) stays.
 *
 * Privacy rule (per plan): never log full message content. Pass character
 * counts, language codes, IDs — not body text.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  readonly ts: string;
  readonly level: LogLevel;
  readonly msg: string;
  readonly [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let minPriority = LEVEL_PRIORITY.info;

export const setLogLevel = (level: LogLevel): void => {
  minPriority = LEVEL_PRIORITY[level];
};

export const log = (level: LogLevel, msg: string, extra: Record<string, unknown> = {}): void => {
  if (LEVEL_PRIORITY[level] < minPriority) return;
  const payload: LogPayload = { ts: new Date().toISOString(), level, msg, ...extra };
  process.stdout.write(JSON.stringify(payload) + '\n');
};
