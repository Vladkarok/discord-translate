/**
 * Discord ephemeral response renderer.
 *
 * Discord limits (per plan §"Ephemeral Message Format"):
 *   - bot message content   = 2000 chars
 *   - embed description     = 4096 chars
 *   - total embed payload   = 6000 chars
 *
 * Strategy:
 *   - Short translations  → content-only render (the common path).
 *   - Long translations   → translation body moves into an embed
 *     (description ≤ 4096), original-text echo gets its own embed if
 *     budget allows. **Never** use file attachments for output (privacy:
 *     Discord CDN URLs are publicly reachable).
 */
import { EmbedBuilder } from 'discord.js';
import type { TranslateSuccess } from '../services/translate.js';

const MAX_CONTENT = 2000;
const EMBED_DESCRIPTION_CAP = 4096;
const EMBED_TOTAL_CAP = 6000;
const CONTENT_PROMOTION_THRESHOLD = 1500; // above this, move body to an embed

export interface RenderedPayload {
  readonly content: string;
  readonly embeds?: EmbedBuilder[];
}

const header = (r: TranslateSuccess): string => {
  const src = r.sourceLanguage ?? '?';
  const arrow = `${src.toUpperCase()} → ${r.targetLanguage.toUpperCase()}`;
  const cacheTag = r.fromCache ? ' · _cached_' : '';
  const detectedTag = r.detected ? ' (detected)' : '';
  return `**${arrow}** · Provider: \`${r.provider}\`${detectedTag}${cacheTag}`;
};

export const renderTranslation = (r: TranslateSuccess): RenderedPayload => {
  const h = header(r);

  // Long translation → embed path
  if (r.translatedText.length > CONTENT_PROMOTION_THRESHOLD) {
    return renderEmbedded(r, h);
  }

  // Short translation → content-only path
  const usedSoFar = h.length + r.translatedText.length + 60; // labels + newlines
  const originalBudget = Math.max(0, MAX_CONTENT - usedSoFar);
  const originalEcho = clip(r.originalText, originalBudget);

  return {
    content: ['', h, '', 'Original:', originalEcho, '', 'Translation:', r.translatedText]
      .join('\n')
      .trimStart()
      .slice(0, MAX_CONTENT),
  };
};

const renderEmbedded = (r: TranslateSuccess, h: string): RenderedPayload => {
  const embeds: EmbedBuilder[] = [];

  // Translation embed (mandatory). Discord truncates a too-long
  // description on render, but be explicit so we know we did it.
  const truncated = r.translatedText.length > EMBED_DESCRIPTION_CAP;
  embeds.push(
    new EmbedBuilder()
      .setTitle('Translation')
      .setDescription(
        truncated ? r.translatedText.slice(0, EMBED_DESCRIPTION_CAP - 1) + '…' : r.translatedText,
      ),
  );

  // Original embed (optional). Fit inside the remaining 6000-char total
  // embed budget; otherwise skip the echo.
  const remaining = EMBED_TOTAL_CAP - embeds[0]!.data.description!.length - 20;
  if (remaining > 100 && r.originalText.length > 0) {
    const cap = Math.min(EMBED_DESCRIPTION_CAP, remaining);
    embeds.push(new EmbedBuilder().setTitle('Original').setDescription(clip(r.originalText, cap)));
  }

  const note = truncated ? '\n_Translation truncated at 4096 chars._' : '';
  return {
    content: (h + note).slice(0, MAX_CONTENT),
    embeds,
  };
};

const clip = (s: string, max: number): string => {
  if (max <= 0) return '_(omitted to fit)_';
  if (s.length <= max) return s;
  if (max <= 3) return '…';
  return s.slice(0, max - 1) + '…';
};
