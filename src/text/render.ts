/**
 * Discord ephemeral response renderer.
 *
 * Caps (per plan §"Ephemeral Message Format"):
 *   - bot message content   = 2000 chars
 *   - (embed description    = 4096; total embed payload = 6000 — M5)
 *
 * v1 uses message content only. If the assembled response exceeds 2000
 * chars, the original-text echo is truncated — the translation itself is
 * never truncated. If the translation alone exceeds the cap, M5 will
 * move it into an embed; v1 returns a compact note.
 */
import type { TranslateSuccess } from '../services/translate.js';

const MAX_CONTENT = 2000;
const HARD_TRANSLATION_BUDGET = 1700; // leave room for header + label

export const renderTranslation = (r: TranslateSuccess): string => {
  const src = r.sourceLanguage ?? '?';
  const arrow = `${src.toUpperCase()} → ${r.targetLanguage.toUpperCase()}`;
  const header = `**${arrow}** · Provider: \`${r.provider}\`${r.detected ? ' (detected)' : ''}`;

  if (r.translatedText.length > HARD_TRANSLATION_BUDGET) {
    // Compact mode: translation alone is too long for ephemeral content.
    // M5 promotes this to an embed; for v1 we apologize and truncate.
    return [
      header,
      '',
      `Translation (truncated to fit Discord's 2000-char ephemeral cap):`,
      r.translatedText.slice(0, HARD_TRANSLATION_BUDGET) + '…',
    ].join('\n');
  }

  // Allocate remaining budget to the original-text echo.
  const usedSoFar = header.length + r.translatedText.length + 60; // labels + newlines
  const originalBudget = Math.max(0, MAX_CONTENT - usedSoFar);
  const originalEcho = clip(r.originalText, originalBudget);

  return [header, '', 'Original:', originalEcho, '', 'Translation:', r.translatedText].join('\n');
};

const clip = (s: string, max: number): string => {
  if (max <= 0) return '_(original omitted to fit)_';
  if (s.length <= max) return s;
  if (max <= 3) return '…';
  return s.slice(0, max - 1) + '…';
};
