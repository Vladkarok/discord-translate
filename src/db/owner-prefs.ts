/**
 * Owner preferences — single-row table.
 *
 * Plan decision: owner identity comes from env (OWNER_DISCORD_ID),
 * never the DB. But the owner still needs a place to persist
 * "Save target" preferences. A 1-row `owner_prefs` table is the
 * smallest clean separation between *identity* (env) and *preferences*
 * (DB).
 */
import type { Database as DatabaseType } from 'better-sqlite3';

export interface OwnerPrefsRow {
  readonly target_language: string | null;
  readonly updated_at: string;
}

export interface OwnerPrefsRepository {
  get(): OwnerPrefsRow;
  setTargetLanguage(lang: string): void;
}

export const createOwnerPrefsRepository = (db: DatabaseType): OwnerPrefsRepository => {
  // Lazy ensure the row exists. CHECK (id = 1) keeps this single-row.
  db.prepare<[string]>(
    `INSERT OR IGNORE INTO owner_prefs (id, target_language, updated_at) VALUES (1, NULL, ?)`,
  ).run(new Date().toISOString());

  const stmts = {
    get: db.prepare<[], OwnerPrefsRow>(
      `SELECT target_language, updated_at FROM owner_prefs WHERE id = 1`,
    ),
    setTarget: db.prepare<[string, string]>(
      `UPDATE owner_prefs SET target_language = ?, updated_at = ? WHERE id = 1`,
    ),
  };

  return {
    get() {
      return stmts.get.get() ?? { target_language: null, updated_at: '' };
    },
    setTargetLanguage(lang) {
      stmts.setTarget.run(lang, new Date().toISOString());
    },
  };
};
