/**
 * Provider usage repository. Atomic SQL check-and-reserve to keep us
 * below the configured monthly limit even under concurrent interactions.
 *
 * The single critical query is:
 *
 *   UPDATE provider_usage
 *      SET characters_used = characters_used + :n, updated_at = :now
 *    WHERE provider = :p AND billing_month = :m
 *      AND characters_used + :n <= monthly_limit;
 *
 * If 0 rows are affected the reservation would overshoot — reject before
 * the HTTP call. Per plan refund rules, only `refund()` on
 * definitely-not-billed failures (see providers/types.ts § isRefundSafe).
 */
import type { Database as DatabaseType } from 'better-sqlite3';

export interface ProviderUsageRow {
  readonly provider: string;
  readonly billing_month: string;
  readonly characters_used: number;
  readonly monthly_limit: number;
  readonly updated_at: string;
}

export interface ProviderUsageRepository {
  /**
   * Idempotently ensure a row exists for the current billing month
   * (`monthly_limit` is set on insert; existing rows are not modified).
   */
  ensure(provider: string, monthlyLimit: number): void;
  /**
   * Atomic check-and-reserve. Returns true on success, false if the
   * reservation would overshoot the configured monthly limit.
   */
  reserve(provider: string, characters: number): boolean;
  /**
   * Refund a previously-reserved amount. Call only on refund-safe
   * provider errors (see ProviderError kind).
   */
  refund(provider: string, characters: number): void;
  /**
   * Snapshot for `/quota status` (M5).
   */
  get(provider: string): ProviderUsageRow | undefined;
}

export const currentBillingMonth = (now: Date = new Date()): string =>
  now.toISOString().slice(0, 7); // 'YYYY-MM' (UTC)

export const createProviderUsageRepository = (db: DatabaseType): ProviderUsageRepository => {
  const stmts = {
    insert: db.prepare<[string, string, number, string]>(
      `INSERT OR IGNORE INTO provider_usage
         (provider, billing_month, characters_used, monthly_limit, updated_at)
       VALUES (?, ?, 0, ?, ?)`,
    ),
    reserve: db.prepare<[number, string, string, string, number]>(
      `UPDATE provider_usage
          SET characters_used = characters_used + ?, updated_at = ?
        WHERE provider = ? AND billing_month = ?
          AND characters_used + ? <= monthly_limit`,
    ),
    refund: db.prepare<[number, string, string, string]>(
      `UPDATE provider_usage
          SET characters_used = MAX(0, characters_used - ?), updated_at = ?
        WHERE provider = ? AND billing_month = ?`,
    ),
    get: db.prepare<[string, string], ProviderUsageRow>(
      `SELECT * FROM provider_usage WHERE provider = ? AND billing_month = ?`,
    ),
  };

  const now = (): string => new Date().toISOString();

  return {
    ensure(provider, monthlyLimit) {
      const month = currentBillingMonth();
      stmts.insert.run(provider, month, monthlyLimit, now());
    },
    reserve(provider, characters) {
      const month = currentBillingMonth();
      // Wrap in a transaction so future per-user daily caps (if reintroduced)
      // can slot in here without changing call sites.
      const tx = db.transaction((p: string, m: string, n: number) => {
        const ts = now();
        const result = stmts.reserve.run(n, ts, p, m, n);
        if (result.changes === 0) {
          throw new QuotaExceededInternal();
        }
      });
      try {
        tx(provider, month, characters);
        return true;
      } catch (err: unknown) {
        if (err instanceof QuotaExceededInternal) return false;
        throw err;
      }
    },
    refund(provider, characters) {
      const month = currentBillingMonth();
      stmts.refund.run(characters, now(), provider, month);
    },
    get(provider) {
      const month = currentBillingMonth();
      return stmts.get.get(provider, month);
    },
  };
};

// Internal sentinel — the transaction throws this to signal "reject"
// without it leaking outside the repository.
class QuotaExceededInternal extends Error {}
