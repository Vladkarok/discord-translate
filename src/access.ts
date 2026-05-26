/**
 * Access control. v1 keeps it deliberately small:
 *
 * - Owner identity comes from env (`OWNER_DISCORD_ID`), never the DB.
 * - Friend allowlist (DB-backed) lands in M2.
 *
 * Per plan decision: owner is not stored as a `users` row.
 */
import type { Config } from './config.js';

export const isOwner = (userId: string, config: Pick<Config, 'OWNER_DISCORD_ID'>): boolean =>
  userId === config.OWNER_DISCORD_ID;
