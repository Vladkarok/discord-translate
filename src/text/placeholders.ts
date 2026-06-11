/**
 * Placeholder protection for non-translatable spans.
 *
 * Per plan §"Message Text And Formatting Protection":
 *   - fenced code blocks
 *   - inline code
 *   - URLs
 *   - Discord mentions (<@id>, <@!id>, <@&id>, <#id>)
 *   - custom emoji tokens (<:name:id>, <a:name:id>)
 *
 * Strategy: replace each protected span with `⟦N⟧` (Unicode math
 * brackets, very unlikely to appear in real chat text). Each protected
 * span is then wrapped in `<span translate="no">...</span>` when sent
 * to Google with `format=html`, which makes Google leave the placeholder
 * untouched.
 *
 * On the way back, we verify every placeholder appears exactly once,
 * then substitute the original span. If any placeholder is missing,
 * duplicated, or out-of-range we throw — corrupted output is worse than
 * an error message.
 */

const PROTECT_RE = new RegExp(
  [
    // Literal placeholder-like tokens FIRST: if user text already contains
    // `⟦7⟧`, mask it as a protected span. Otherwise rehydrate() would match
    // it and throw out_of_range, making the message untranslatable.
    /⟦\d+⟧/.source,
    /```[\s\S]*?```/.source, // fenced code blocks (multi-line, non-greedy)
    /`[^`\n]+`/.source, // inline code (single line)
    /https?:\/\/\S+/.source, // URLs
    /<a?:\w+:\d+>/.source, // custom emoji
    /<@[!&]?\d+>/.source, // user/role mention
    /<#\d+>/.source, // channel mention
  ].join('|'),
  'g',
);

const PLACEHOLDER_RE = /⟦(\d+)⟧/g;

export interface MaskedText {
  readonly masked: string; // text with `⟦N⟧` markers
  readonly originals: readonly string[]; // index N → original span
}

export const protect = (text: string): MaskedText => {
  const originals: string[] = [];
  const masked = text.replace(PROTECT_RE, (m) => {
    const i = originals.length;
    originals.push(m);
    return `⟦${String(i)}⟧`;
  });
  return { masked, originals };
};

export type RehydrateError =
  | { kind: 'missing'; missing: readonly number[] }
  | { kind: 'duplicate'; index: number }
  | { kind: 'out_of_range'; index: number };

export class PlaceholderIntegrityError extends Error {
  constructor(public readonly detail: RehydrateError) {
    super(`placeholder integrity: ${detail.kind}`);
    this.name = 'PlaceholderIntegrityError';
  }
}

export const rehydrate = (translated: string, originals: readonly string[]): string => {
  const seen = new Set<number>();
  const result = translated.replace(PLACEHOLDER_RE, (_, idStr: string) => {
    const id = Number(idStr);
    if (id < 0 || id >= originals.length) {
      throw new PlaceholderIntegrityError({ kind: 'out_of_range', index: id });
    }
    if (seen.has(id)) {
      throw new PlaceholderIntegrityError({ kind: 'duplicate', index: id });
    }
    seen.add(id);
    return originals[id] ?? '';
  });

  if (seen.size !== originals.length) {
    const missing: number[] = [];
    for (let i = 0; i < originals.length; i++) {
      if (!seen.has(i)) missing.push(i);
    }
    throw new PlaceholderIntegrityError({ kind: 'missing', missing });
  }

  return result;
};

/**
 * Build a Google-Translate-friendly HTML payload for the masked text.
 * Placeholders go inside `<span translate="no">` so Google leaves them
 * alone. The surrounding text is HTML-escaped so user content with
 * `<`, `>`, `&` doesn't break the markup.
 */
export const toHtmlPayload = (masked: string): string => {
  const parts = masked.split(/(⟦\d+⟧)/g);
  return parts
    .map((p) => {
      const m = /^⟦(\d+)⟧$/.exec(p);
      if (m) return `<span translate="no">⟦${m[1]!}⟧</span>`;
      return escapeHtml(p);
    })
    .join('');
};

/**
 * Reverse the Google response: strip our wrapper spans (Google may or
 * may not preserve them verbatim), then HTML-unescape the rest. Returns
 * text with `⟦N⟧` markers still in place — call `rehydrate` afterward.
 */
export const fromHtmlPayload = (html: string): string => {
  // Strip our wrapper spans whether or not Google echoed the attribute
  // exactly. We also tolerate Google sometimes folding them into bare
  // text via translate="no" being respected.
  const stripped = html.replace(/<span[^>]*>(⟦\d+⟧)<\/span>/g, '$1');
  return unescapeHtml(stripped);
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const unescapeHtml = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
