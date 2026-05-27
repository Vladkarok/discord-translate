/**
 * Translation orchestrator. The Discord interaction layer calls this and
 * gets back either a finished render or a typed failure.
 *
 * Order of operations (per plan §"Translation Service Design"):
 *
 *   1. Protect non-translatable spans → masked text.
 *   2. Build provider payload (format=html) → know billed characters.
 *   3. Atomic quota reservation against provider monthly cap.
 *   4. Call the provider.
 *   5. On provider error: refund only if refund-safe.
 *   6. Rehydrate placeholders, verify integrity.
 *   7. Return result.
 *
 * Cache lookup is M5; not in this milestone.
 */
import {
  PlaceholderIntegrityError,
  fromHtmlPayload,
  protect,
  rehydrate,
  toHtmlPayload,
} from '../text/placeholders.js';
import {
  ProviderError,
  isRefundSafe,
  type ProviderErrorKind,
  type TranslationProvider,
} from '../providers/types.js';
import type { ProviderUsageRepository } from '../db/provider-usage.js';
import { log } from '../logger.js';

export interface TranslateRequest {
  readonly text: string; // raw message content
  readonly sourceLanguage?: string; // 'auto' or ISO; undefined === auto
  readonly targetLanguage: string;
}

export interface TranslateSuccess {
  readonly ok: true;
  readonly provider: string;
  readonly sourceLanguage: string | null;
  readonly targetLanguage: string;
  readonly detected: boolean;
  readonly originalText: string;
  readonly translatedText: string;
  readonly billedCharacters: number;
}

export type TranslateFailureKind =
  | 'empty_input'
  | 'quota_exceeded'
  | 'unsupported_language'
  | 'auth_error'
  | 'rate_limited'
  | 'transient_error'
  | 'placeholder_corruption'
  | 'unknown_error';

export interface TranslateFailure {
  readonly ok: false;
  readonly kind: TranslateFailureKind;
  readonly message: string;
}

export type TranslateOutcome = TranslateSuccess | TranslateFailure;

export interface TranslateServiceDeps {
  readonly provider: TranslationProvider;
  readonly usage: ProviderUsageRepository;
  readonly providerMonthlyLimit: number;
}

export const createTranslateService = (deps: TranslateServiceDeps) => {
  // Ensure the current month's row exists once at startup. Subsequent
  // months will lazily ensure on first call.
  deps.usage.ensure(deps.provider.name, deps.providerMonthlyLimit);
  let lastEnsuredMonth = '';

  return async (req: TranslateRequest): Promise<TranslateOutcome> => {
    if (!req.text.trim()) {
      return { ok: false, kind: 'empty_input', message: 'That message has no text to translate.' };
    }

    // Protect non-translatable spans, then build the provider payload.
    const { masked, originals } = protect(req.text);
    const payload = toHtmlPayload(masked);

    // Re-ensure if the month rolled over while the bot was running.
    const monthNow = new Date().toISOString().slice(0, 7);
    if (monthNow !== lastEnsuredMonth) {
      deps.usage.ensure(deps.provider.name, deps.providerMonthlyLimit);
      lastEnsuredMonth = monthNow;
    }

    const billed = payload.length;
    const reserved = deps.usage.reserve(deps.provider.name, billed);
    if (!reserved) {
      log('warn', 'translate.quota_exceeded', { provider: deps.provider.name, billed });
      return {
        ok: false,
        kind: 'quota_exceeded',
        message: 'Monthly translation quota reached. Try again next month.',
      };
    }

    let providerResult;
    try {
      // exactOptionalPropertyTypes — only include sourceLanguage when set.
      const providerInput =
        req.sourceLanguage === undefined
          ? { text: payload, targetLanguage: req.targetLanguage }
          : {
              text: payload,
              sourceLanguage: req.sourceLanguage,
              targetLanguage: req.targetLanguage,
            };
      providerResult = await deps.provider.translate(providerInput);
    } catch (err: unknown) {
      const kind: ProviderErrorKind = err instanceof ProviderError ? err.kind : 'unknown';
      const message = err instanceof Error ? err.message : String(err);

      if (isRefundSafe(kind)) {
        deps.usage.refund(deps.provider.name, billed);
        log('warn', 'translate.refunded', { kind, billed });
      } else {
        log('warn', 'translate.kept_reservation', { kind, billed });
      }

      return { ok: false, kind: mapErrorKind(kind), message };
    }

    // Rehydrate placeholders. Strip Google's HTML wrapping first.
    let translatedText: string;
    try {
      const unwrapped = fromHtmlPayload(providerResult.translatedText);
      translatedText = rehydrate(unwrapped, originals);
    } catch (err: unknown) {
      // Placeholder corruption — Google already billed us. Keep reservation,
      // surface a clear error.
      log('error', 'translate.placeholder_corruption', {
        err: err instanceof PlaceholderIntegrityError ? err.detail : String(err),
        billed,
      });
      return {
        ok: false,
        kind: 'placeholder_corruption',
        message:
          'The translation came back malformed (mentions or code blocks were lost). Please try again.',
      };
    }

    return {
      ok: true,
      provider: providerResult.provider,
      sourceLanguage: providerResult.sourceLanguage,
      targetLanguage: providerResult.targetLanguage,
      detected: providerResult.detected,
      originalText: req.text,
      translatedText,
      billedCharacters: billed,
    };
  };
};

export type TranslateService = ReturnType<typeof createTranslateService>;

const mapErrorKind = (kind: ProviderErrorKind): TranslateFailureKind => {
  switch (kind) {
    case 'auth':
      return 'auth_error';
    case 'unsupported_language':
    case 'pre_send_validation':
      return 'unsupported_language';
    case 'rate_limited':
      return 'rate_limited';
    case 'transient':
      return 'transient_error';
    case 'unknown':
      return 'unknown_error';
  }
};
