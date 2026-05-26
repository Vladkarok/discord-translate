/**
 * SQLite connection lifecycle.
 *
 * Single-process bot → single writer → better-sqlite3's synchronous
 * API is the right fit (avoids async/await accounting in atomic quota
 * paths in M3).
 *
 * WAL mode improves concurrent reads (the bot's own future jobs) without
 * costing single-writer correctness.
 */
import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { log } from '../logger.js';

export const openDatabase = (path: string): DatabaseType => {
  // Ensure parent directory exists — fresh container or new volume mount
  // would otherwise fail to open the file.
  mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  log('info', 'db.opened', { path });
  return db;
};

export const closeDatabase = (db: DatabaseType): void => {
  try {
    db.close();
    log('info', 'db.closed');
  } catch (err: unknown) {
    log('error', 'db.close_failed', { err: err instanceof Error ? err.message : String(err) });
  }
};
