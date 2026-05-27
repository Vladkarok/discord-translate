/**
 * Translation cache repository (hash-only by default).
 *
 * Key composition: `sha256(provider|source|target|maskedText)`. The
 * masked text already has mentions/URLs/code replaced with ⟦N⟧
 * placeholders — so the cache value (the provider's response, also
 * containing ⟦N⟧) is itself placeholder-only. No raw user content lands
 * on disk unless `CACHE_STORE_SOURCE_TEXT=true` flips the opt-in.
 *
 * Different users sending the same masked text get the same key,
 * deduplicating across the whole bot (correct because translation is
 * not user-specific).
 *
 * Retention: 30 days. `prune()` runs once on boot.
 */
import type { Database as DatabaseType } from 'better-sqlite3';
import { createHash } from 'node:crypto';

export interface CacheKeyInputs {
  readonly provider: string;
  readonly sourceLanguage: string; // 'auto' or ISO code
  readonly targetLanguage: string;
  readonly maskedText: string;
}

export interface CacheRecord {
  readonly cache_key: string;
  readonly provider: string;
  readonly source_language: string | null;
  readonly target_language: string;
  readonly source_hash: string;
  readonly source_text: string | null;
  readonly translated_text: string; // contains ⟦N⟧ placeholders, pre-rehydrate
  readonly created_at: string;
}

export interface CachePutInput {
  readonly key: string;
  readonly provider: string;
  readonly sourceLanguage: string | null;
  readonly targetLanguage: string;
  readonly maskedText: string;
  readonly translatedText: string; // pre-rehydrate
  readonly storeSourceText: boolean;
}

export interface TranslationCacheRepository {
  computeKey(inputs: CacheKeyInputs): string;
  get(key: string): CacheRecord | undefined;
  put(input: CachePutInput): void;
  /** Returns number of rows pruned. */
  prune(retentionDays: number): number;
  size(): number;
}

export const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export const createTranslationCacheRepository = (db: DatabaseType): TranslationCacheRepository => {
  const stmts = {
    get: db.prepare<[string], CacheRecord>(`SELECT * FROM translation_cache WHERE cache_key = ?`),
    put: db.prepare<[string, string, string | null, string, string, string | null, string, string]>(
      `INSERT OR REPLACE INTO translation_cache
         (cache_key, provider, source_language, target_language,
          source_hash, source_text, translated_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    prune: db.prepare<[string]>(`DELETE FROM translation_cache WHERE created_at < ?`),
    count: db.prepare<[], { n: number }>(`SELECT COUNT(*) as n FROM translation_cache`),
  };

  return {
    computeKey(inputs) {
      return sha256Hex(
        `${inputs.provider}|${inputs.sourceLanguage}|${inputs.targetLanguage}|${inputs.maskedText}`,
      );
    },
    get(key) {
      return stmts.get.get(key);
    },
    put(input) {
      const sourceHash = sha256Hex(input.maskedText);
      const sourceText = input.storeSourceText ? input.maskedText : null;
      stmts.put.run(
        input.key,
        input.provider,
        input.sourceLanguage,
        input.targetLanguage,
        sourceHash,
        sourceText,
        input.translatedText,
        new Date().toISOString(),
      );
    },
    prune(retentionDays) {
      const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
      return stmts.prune.run(cutoff).changes;
    },
    size() {
      return stmts.count.get()?.n ?? 0;
    },
  };
};
