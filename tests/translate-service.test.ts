import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database as DatabaseType } from 'better-sqlite3';
import { createTranslationCacheRepository } from '../src/db/cache.js';
import { runMigrations } from '../src/db/migrate.js';
import { createProviderUsageRepository } from '../src/db/provider-usage.js';
import { ProviderError } from '../src/providers/types.js';
import type {
  TranslateInput,
  TranslateResult,
  TranslationProvider,
} from '../src/providers/types.js';
import { createTranslateService } from '../src/services/translate.js';

const LIMIT = 10_000;

const echoProvider = (
  translateImpl?: (input: TranslateInput) => Promise<TranslateResult>,
): { provider: TranslationProvider; calls: TranslateInput[] } => {
  const calls: TranslateInput[] = [];
  const defaultImpl = (input: TranslateInput): Promise<TranslateResult> =>
    Promise.resolve({
      provider: 'fake',
      sourceLanguage: 'fr',
      targetLanguage: input.targetLanguage,
      translatedText: input.text, // echo — placeholders survive
      detected: !input.sourceLanguage,
      billedCharacters: input.text.length,
    });
  return {
    provider: {
      name: 'fake',
      supports: () => true,
      translate: (input) => {
        calls.push(input);
        return (translateImpl ?? defaultImpl)(input);
      },
    },
    calls,
  };
};

describe('translate service', () => {
  let db: DatabaseType;

  const buildService = (
    provider: TranslationProvider,
    monthlyLimit = LIMIT,
  ): ReturnType<typeof createTranslateService> => {
    const usage = createProviderUsageRepository(db);
    const cache = createTranslationCacheRepository(db);
    return createTranslateService({
      provider,
      usage,
      cache,
      providerMonthlyLimit: monthlyLimit,
      storeSourceText: false,
    });
  };

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('rejects empty input without calling the provider', async () => {
    const { provider, calls } = echoProvider();
    const service = buildService(provider);
    const outcome = await service({ text: '   ', targetLanguage: 'en' });
    expect(outcome).toMatchObject({ ok: false, kind: 'empty_input' });
    expect(calls).toHaveLength(0);
  });

  it('translates, bills the payload, and rehydrates placeholders', async () => {
    const { provider, calls } = echoProvider();
    const service = buildService(provider);
    const outcome = await service({ text: 'hi <@123> & `code`', targetLanguage: 'en' });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.translatedText).toBe('hi <@123> & `code`');
    expect(outcome.fromCache).toBe(false);
    expect(outcome.billedCharacters).toBeGreaterThan(0);
    // Provider saw masked + escaped payload, not the raw message.
    expect(calls[0]!.text).not.toContain('<@123>');
    expect(calls[0]!.text).toContain('&amp;');
  });

  it('serves the second identical request from cache with zero billing', async () => {
    const { provider, calls } = echoProvider();
    const service = buildService(provider);
    const usage = createProviderUsageRepository(db);

    const first = await service({ text: 'hello world', targetLanguage: 'en' });
    const second = await service({ text: 'hello world', targetLanguage: 'en' });

    expect(first.ok && !first.fromCache).toBe(true);
    expect(second.ok && second.fromCache).toBe(true);
    if (!second.ok) return;
    expect(second.billedCharacters).toBe(0);
    expect(calls).toHaveLength(1);
    expect(usage.get('fake')?.characters_used).toBe('hello world'.length);
  });

  it("treats 'auto' and undefined source as the same cache entry", async () => {
    const { provider, calls } = echoProvider();
    const service = buildService(provider);

    await service({ text: 'hello world', targetLanguage: 'en' });
    const viaAuto = await service({
      text: 'hello world',
      sourceLanguage: 'auto',
      targetLanguage: 'en',
    });

    expect(viaAuto.ok && viaAuto.fromCache).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('fails with quota_exceeded before calling the provider when the cap is hit', async () => {
    const { provider, calls } = echoProvider();
    const service = buildService(provider, 3); // payload 'hello' (5 chars) > 3
    const outcome = await service({ text: 'hello', targetLanguage: 'en' });
    expect(outcome).toMatchObject({ ok: false, kind: 'quota_exceeded' });
    expect(calls).toHaveLength(0);
  });

  it('refunds the reservation on refund-safe provider errors', async () => {
    const { provider } = echoProvider(() =>
      Promise.reject(new ProviderError('rate_limited', 'slow down')),
    );
    const service = buildService(provider);
    const usage = createProviderUsageRepository(db);

    const outcome = await service({ text: 'hello', targetLanguage: 'en' });
    expect(outcome).toMatchObject({ ok: false, kind: 'rate_limited' });
    expect(usage.get('fake')?.characters_used).toBe(0);
  });

  it('keeps the reservation on ambiguous (transient) provider errors', async () => {
    const { provider } = echoProvider(() =>
      Promise.reject(new ProviderError('transient', 'http 500')),
    );
    const service = buildService(provider);
    const usage = createProviderUsageRepository(db);

    const outcome = await service({ text: 'hello', targetLanguage: 'en' });
    expect(outcome).toMatchObject({ ok: false, kind: 'transient_error' });
    expect(usage.get('fake')?.characters_used).toBe('hello'.length);
  });

  it('fails with placeholder_corruption when the provider loses a placeholder', async () => {
    const { provider } = echoProvider((input) =>
      Promise.resolve({
        provider: 'fake',
        sourceLanguage: 'fr',
        targetLanguage: input.targetLanguage,
        translatedText: 'placeholder went missing',
        detected: true,
        billedCharacters: input.text.length,
      }),
    );
    const service = buildService(provider);

    const outcome = await service({ text: 'hi <@123>', targetLanguage: 'en' });
    expect(outcome).toMatchObject({ ok: false, kind: 'placeholder_corruption' });
  });
});
