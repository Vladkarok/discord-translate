/**
 * Users (friend allowlist) repository.
 *
 * Owner is NOT stored here — `OWNER_DISCORD_ID` env is the single source
 * of truth (plan decision). This table holds only friends.
 *
 * All statements are prepared once at construction; prepared statements
 * are cheap to reuse and avoid SQL parsing on every call.
 */
import type { Database as DatabaseType } from 'better-sqlite3';

export interface FriendRow {
  readonly discord_user_id: string;
  readonly role: 'friend';
  readonly target_language: string | null;
  readonly server_usage_enabled: 0 | 1;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface UsersRepository {
  addFriend(userId: string): boolean; // false = already a friend
  removeFriend(userId: string): boolean; // false = was not a friend
  isFriend(userId: string): boolean;
  getFriend(userId: string): FriendRow | undefined;
  listFriends(): readonly FriendRow[];
  setServerUsage(userId: string, enabled: boolean): boolean; // false = not a friend
  setTargetLanguage(userId: string, lang: string): boolean; // false = not a friend
  count(): number;
}

export const createUsersRepository = (db: DatabaseType): UsersRepository => {
  const stmts = {
    insert: db.prepare<[string, string, string]>(
      `INSERT OR IGNORE INTO users
        (discord_user_id, role, server_usage_enabled, created_at, updated_at)
       VALUES (?, 'friend', 0, ?, ?)`,
    ),
    delete: db.prepare<[string]>(`DELETE FROM users WHERE discord_user_id = ?`),
    selectOne: db.prepare<[string], FriendRow>(`SELECT * FROM users WHERE discord_user_id = ?`),
    selectAll: db.prepare<[], FriendRow>(`SELECT * FROM users ORDER BY created_at ASC`),
    count: db.prepare<[], { n: number }>(`SELECT COUNT(*) as n FROM users`),
    setServer: db.prepare<[number, string, string]>(
      `UPDATE users SET server_usage_enabled = ?, updated_at = ? WHERE discord_user_id = ?`,
    ),
    setTarget: db.prepare<[string, string, string]>(
      `UPDATE users SET target_language = ?, updated_at = ? WHERE discord_user_id = ?`,
    ),
  };

  const now = (): string => new Date().toISOString();

  return {
    addFriend(userId) {
      const ts = now();
      return stmts.insert.run(userId, ts, ts).changes > 0;
    },
    removeFriend(userId) {
      return stmts.delete.run(userId).changes > 0;
    },
    isFriend(userId) {
      return stmts.selectOne.get(userId) !== undefined;
    },
    getFriend(userId) {
      return stmts.selectOne.get(userId);
    },
    listFriends() {
      return stmts.selectAll.all();
    },
    setServerUsage(userId, enabled) {
      return stmts.setServer.run(enabled ? 1 : 0, now(), userId).changes > 0;
    },
    setTargetLanguage(userId, lang) {
      return stmts.setTarget.run(lang, now(), userId).changes > 0;
    },
    count() {
      const row = stmts.count.get();
      return row?.n ?? 0;
    },
  };
};
