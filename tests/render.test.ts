import { describe, expect, it } from 'vitest';
import { renderTranslation } from '../src/text/render.js';
import type { TranslateSuccess } from '../src/services/translate.js';

const success = (overrides: Partial<TranslateSuccess> = {}): TranslateSuccess => ({
  ok: true,
  provider: 'google',
  sourceLanguage: 'fr',
  targetLanguage: 'en',
  detected: true,
  originalText: 'bonjour',
  translatedText: 'hello',
  billedCharacters: 7,
  fromCache: false,
  ...overrides,
});

describe('renderTranslation — short path', () => {
  it('renders content-only with header, original, and translation', () => {
    const payload = renderTranslation(success());
    expect(payload.embeds).toBeUndefined();
    expect(payload.content).toContain('**FR → EN**');
    expect(payload.content).toContain('(detected)');
    expect(payload.content).toContain('Original:\nbonjour');
    expect(payload.content).toContain('Translation:\nhello');
    expect(payload.content.length).toBeLessThanOrEqual(2000);
  });

  it('marks cached results', () => {
    const payload = renderTranslation(success({ fromCache: true }));
    expect(payload.content).toContain('_cached_');
  });

  it('shows ? for unknown source language', () => {
    const payload = renderTranslation(success({ sourceLanguage: null }));
    expect(payload.content).toContain('**? → EN**');
  });

  it('clips a long original echo to stay under the 2000-char content cap', () => {
    const payload = renderTranslation(
      success({ originalText: 'x'.repeat(5000), translatedText: 'y'.repeat(1400) }),
    );
    expect(payload.embeds).toBeUndefined();
    expect(payload.content.length).toBeLessThanOrEqual(2000);
    expect(payload.content).toContain('y'.repeat(1400));
  });
});

describe('renderTranslation — embed promotion', () => {
  it('moves translations above 1500 chars into an embed', () => {
    const payload = renderTranslation(success({ translatedText: 'z'.repeat(1501) }));
    expect(payload.embeds).toBeDefined();
    expect(payload.embeds).toHaveLength(2); // translation + original echo
    expect(payload.embeds![0]!.data.description).toBe('z'.repeat(1501));
  });

  it('truncates at the 4096 embed description cap and says so', () => {
    const payload = renderTranslation(success({ translatedText: 'z'.repeat(5000) }));
    const description = payload.embeds![0]!.data.description!;
    expect(description.length).toBe(4096);
    expect(description.endsWith('…')).toBe(true);
    expect(payload.content).toContain('Translation truncated');
  });

  it('skips the original echo when the 6000-char total embed budget is spent', () => {
    const payload = renderTranslation(
      success({ translatedText: 'z'.repeat(5000), originalText: 'o'.repeat(3000) }),
    );
    const totalDescriptions = payload.embeds!.reduce(
      (sum, e) => sum + (e.data.description?.length ?? 0),
      0,
    );
    expect(totalDescriptions).toBeLessThanOrEqual(6000);
  });

  it('keeps content header within 2000 chars', () => {
    const payload = renderTranslation(success({ translatedText: 'z'.repeat(5000) }));
    expect(payload.content.length).toBeLessThanOrEqual(2000);
  });
});
