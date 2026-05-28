/**
 * Google Cloud Translation v2 adapter (API-key auth).
 *
 * Endpoint:
 *   POST https://translation.googleapis.com/language/translate/v2?key=KEY
 *   { q: [text], target: 'en', source?: 'fr', format: 'html' }
 *
 * Billing: Google bills the total length of the `q` strings sent,
 * including HTML markup (so our `<span translate="no">` wrappers count).
 * `billedCharacters` reflects that.
 *
 * v1 uses format=html so we can wrap placeholders in
 * `<span translate="no">` and have Google leave them alone (per its
 * documented behavior for the `translate` attribute).
 *
 * Free tier: 500K characters/month total (Basic + Advanced). Permanent.
 */
import { ProviderError, type TranslationProvider } from './types.js';

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';
const PROVIDER_NAME = 'google';

// Google v2 accepts ISO 639-1 codes. Our internal `en`, `fr`, `uk`, `ru`
// map 1:1 (no regional variants required).
const SUPPORTED_TARGETS = new Set(['en', 'fr', 'uk', 'ru']);
const SUPPORTED_SOURCES = new Set(['en', 'fr', 'uk', 'ru', 'auto']);

export interface GoogleProviderOptions {
  readonly apiKey: string;
  readonly fetchImpl?: typeof fetch; // injectable for tests
  readonly timeoutMs?: number; // default 10s
}

interface GoogleResponse {
  readonly data?: {
    readonly translations?: ReadonlyArray<{
      readonly translatedText?: string;
      readonly detectedSourceLanguage?: string;
    }>;
  };
  readonly error?: {
    readonly code?: number;
    readonly message?: string;
    readonly status?: string;
  };
}

export const createGoogleProvider = (opts: GoogleProviderOptions): TranslationProvider => {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  return {
    name: PROVIDER_NAME,

    supports(input) {
      const src = input.sourceLanguage ?? 'auto';
      return SUPPORTED_SOURCES.has(src) && SUPPORTED_TARGETS.has(input.targetLanguage);
    },

    async translate(input) {
      if (!this.supports(input)) {
        throw new ProviderError(
          'unsupported_language',
          `unsupported language pair: ${input.sourceLanguage ?? 'auto'} -> ${input.targetLanguage}`,
        );
      }

      const body: Record<string, unknown> = {
        q: [input.text],
        target: input.targetLanguage,
        format: 'html',
      };
      if (input.sourceLanguage && input.sourceLanguage !== 'auto') {
        body.source = input.sourceLanguage;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      let res: Response;
      try {
        res = await fetchImpl(`${ENDPOINT}?key=${encodeURIComponent(opts.apiKey)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err: unknown) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        throw new ProviderError(
          'transient',
          isAbort
            ? `request timed out after ${String(timeoutMs)}ms`
            : `network error: ${stringifyErr(err)}`,
          err,
        );
      } finally {
        clearTimeout(timer);
      }

      const json = (await safeJson(res)) as GoogleResponse;

      if (!res.ok) {
        throw classifyHttpError(res.status, json);
      }

      const translation = json.data?.translations?.[0];
      if (!translation?.translatedText) {
        throw new ProviderError('unknown', 'google response missing translatedText');
      }

      const detected = !input.sourceLanguage || input.sourceLanguage === 'auto';

      return {
        provider: PROVIDER_NAME,
        sourceLanguage: translation.detectedSourceLanguage ?? input.sourceLanguage ?? null,
        targetLanguage: input.targetLanguage,
        translatedText: translation.translatedText,
        detected,
        billedCharacters: input.text.length, // Google bills q-string length
      };
    },
  };
};

const classifyHttpError = (status: number, json: GoogleResponse): ProviderError => {
  const msg = json.error?.message ?? `HTTP ${String(status)}`;
  if (status === 400) {
    // Distinguish unsupported lang from generic 400 by message text.
    if (/invalid.*(target|source)/i.test(msg) || /language/i.test(msg)) {
      return new ProviderError('unsupported_language', msg);
    }
    return new ProviderError('pre_send_validation', msg);
  }
  if (status === 401 || status === 403) {
    return new ProviderError('auth', msg);
  }
  if (status === 429) {
    return new ProviderError('rate_limited', msg);
  }
  if (status >= 500) {
    return new ProviderError('transient', msg);
  }
  return new ProviderError('unknown', msg);
};

const safeJson = async (res: Response): Promise<unknown> => {
  try {
    return await res.json();
  } catch {
    return {};
  }
};

const stringifyErr = (err: unknown): string => (err instanceof Error ? err.message : String(err));
