import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database as DatabaseType } from 'better-sqlite3';
import { runMigrations } from '../src/db/migrate.js';
import {
  createProviderUsageRepository,
  currentBillingMonth,
  type ProviderUsageRepository,
} from '../src/db/provider-usage.js';

const PROVIDER = 'google';
const LIMIT = 1000;

describe('currentBillingMonth', () => {
  it('formats YYYY-MM in UTC', () => {
    expect(currentBillingMonth(new Date('2026-06-11T23:59:00Z'))).toBe('2026-06');
    expect(currentBillingMonth(new Date('2025-01-02T00:00:00Z'))).toBe('2025-01');
  });
});

describe('provider usage repository', () => {
  let db: DatabaseType;
  let usage: ProviderUsageRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    usage = createProviderUsageRepository(db);
    usage.ensure(PROVIDER, LIMIT);
  });

  afterEach(() => {
    db.close();
  });

  it('ensure is idempotent and does not reset usage', () => {
    expect(usage.reserve(PROVIDER, 100)).toBe(true);
    usage.ensure(PROVIDER, LIMIT);
    expect(usage.get(PROVIDER)?.characters_used).toBe(100);
  });

  it('ensure does not change the limit of an existing row', () => {
    usage.ensure(PROVIDER, 9999);
    expect(usage.get(PROVIDER)?.monthly_limit).toBe(LIMIT);
  });

  it('reserves up to the limit, including an exact fit', () => {
    expect(usage.reserve(PROVIDER, 400)).toBe(true);
    expect(usage.reserve(PROVIDER, 600)).toBe(true); // exactly at the cap
    expect(usage.get(PROVIDER)?.characters_used).toBe(LIMIT);
  });

  it('rejects a reservation that would overshoot, leaving usage untouched', () => {
    expect(usage.reserve(PROVIDER, 950)).toBe(true);
    expect(usage.reserve(PROVIDER, 51)).toBe(false);
    expect(usage.get(PROVIDER)?.characters_used).toBe(950);
  });

  it('rejects reservations for an unknown provider', () => {
    expect(usage.reserve('nonexistent', 1)).toBe(false);
  });

  it('refunds a reservation', () => {
    usage.reserve(PROVIDER, 300);
    usage.refund(PROVIDER, 200);
    expect(usage.get(PROVIDER)?.characters_used).toBe(100);
  });

  it('refund floors at zero', () => {
    usage.reserve(PROVIDER, 100);
    usage.refund(PROVIDER, 500);
    expect(usage.get(PROVIDER)?.characters_used).toBe(0);
  });

  it('get returns the current month row', () => {
    const row = usage.get(PROVIDER);
    expect(row?.billing_month).toBe(currentBillingMonth());
    expect(row?.monthly_limit).toBe(LIMIT);
  });
});
