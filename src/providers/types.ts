/**
 * Translation provider interface. The single seam between Discord
 * interaction code and translation backends.
 *
 * `supports()` is intentionally synchronous so provider routing can run
 * before quota reservation without forcing an async hop.
 *
 * Errors are thrown by adapters; the orchestrator classifies and
 * decides refund semantics.
 */

export interface TranslateInput {
  readonly text: string; // raw text to send (post placeholder masking)
  readonly sourceLanguage?: string; // ISO code; undefined = auto-detect
  readonly targetLanguage: string;
}

export interface TranslateResult {
  readonly provider: string;
  readonly sourceLanguage: string | null; // null if provider returned none
  readonly targetLanguage: string;
  readonly translatedText: string;
  readonly detected: boolean; // true if sourceLanguage was auto-detected
  readonly billedCharacters: number; // characters Google/DeepL will bill us for
}

export interface TranslationProvider {
  readonly name: string;
  supports(input: TranslateInput): boolean;
  translate(input: TranslateInput): Promise<TranslateResult>;
}

/**
 * Provider error classification. Drives the asymmetric refund rule:
 *
 *   refund-safe  → request never reached the provider OR was rejected
 *                  before being processed (no characters billed).
 *   keep-reserved → request may have been billed; we cannot prove
 *                   otherwise, so we keep the local reservation.
 */
export type ProviderErrorKind =
  | 'auth' // 401/403 before processing — refund safe
  | 'unsupported_language' // 400 invalid source/target — refund safe
  | 'pre_send_validation' // local check failed — refund safe
  | 'rate_limited' // 429 — refund safe (rejected, not processed)
  | 'transient' // 5xx / timeout — KEEP reservation (ambiguous billing)
  | 'unknown'; // unclassified post-send error — KEEP reservation

export class ProviderError extends Error {
  constructor(
    public readonly kind: ProviderErrorKind,
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export const isRefundSafe = (kind: ProviderErrorKind): boolean =>
  kind === 'auth' ||
  kind === 'unsupported_language' ||
  kind === 'pre_send_validation' ||
  kind === 'rate_limited';
