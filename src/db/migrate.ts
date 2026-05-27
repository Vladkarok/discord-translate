/**
 * Startup migrator. Idempotent `CREATE TABLE IF NOT EXISTS` for the v1
 * schema. No migration framework — 3 tables, no schema churn pressure
 * (per plan decision).
 *
 * Schema mirrors `docs/plans/discord-translation-bot.md` § Data Model
 * Draft, minus the dropped `user_daily_usage` table (daily cap reversed)
 * and minus an `allowed_servers` table (single boolean covers v1).
 */
import type { Database as DatabaseType } from 'better-sqlite3';
import { log } from '../logger.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  discord_user_id      TEXT PRIMARY KEY,
  role                 TEXT NOT NULL CHECK (role IN ('friend')),
  target_language      TEXT,
  server_usage_enabled INTEGER NOT NULL DEFAULT 0 CHECK (server_usage_enabled IN (0, 1)),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_usage (
  provider        TEXT NOT NULL,
  billing_month   TEXT NOT NULL,  -- 'YYYY-MM'
  characters_used INTEGER NOT NULL DEFAULT 0,
  monthly_limit   INTEGER NOT NULL,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (provider, billing_month)
);

CREATE TABLE IF NOT EXISTS translation_cache (
  cache_key       TEXT PRIMARY KEY,
  provider        TEXT NOT NULL,
  source_language TEXT,
  target_language TEXT NOT NULL,
  source_hash     TEXT NOT NULL,
  source_text     TEXT,            -- populated only when CACHE_STORE_SOURCE_TEXT=true
  translated_text TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_translation_cache_created_at
  ON translation_cache (created_at);

CREATE TABLE IF NOT EXISTS owner_prefs (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  target_language TEXT,
  updated_at      TEXT NOT NULL
);
`;

export const runMigrations = (db: DatabaseType): void => {
  db.exec(SCHEMA);
  log('info', 'db.migrated', {
    tables: ['users', 'provider_usage', 'translation_cache', 'owner_prefs'],
  });
};
