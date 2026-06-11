import { describe, expect, it } from 'vitest';
import {
  PlaceholderIntegrityError,
  fromHtmlPayload,
  protect,
  rehydrate,
  toHtmlPayload,
} from '../src/text/placeholders.js';

describe('protect', () => {
  it('masks fenced code blocks', () => {
    const { masked, originals } = protect('before ```const x = 1;\nfoo()``` after');
    expect(masked).toBe('before ⟦0⟧ after');
    expect(originals).toEqual(['```const x = 1;\nfoo()```']);
  });

  it('masks inline code', () => {
    const { masked, originals } = protect('run `npm test` now');
    expect(masked).toBe('run ⟦0⟧ now');
    expect(originals).toEqual(['`npm test`']);
  });

  it('masks URLs', () => {
    const { masked, originals } = protect('see https://example.com/a?b=1 please');
    expect(masked).toBe('see ⟦0⟧ please');
    expect(originals).toEqual(['https://example.com/a?b=1']);
  });

  it('masks mentions and custom emoji', () => {
    const { masked, originals } = protect(
      '<@123456789> hi <@!42> <@&7> <#999> <:wave:111> <a:p:2>',
    );
    expect(masked).toBe('⟦0⟧ hi ⟦1⟧ ⟦2⟧ ⟦3⟧ ⟦4⟧ ⟦5⟧');
    expect(originals).toHaveLength(6);
  });

  it('masks literal placeholder-like tokens in user text', () => {
    const { masked, originals } = protect('weird input ⟦7⟧ here');
    expect(masked).toBe('weird input ⟦0⟧ here');
    expect(originals).toEqual(['⟦7⟧']);
  });

  it('returns text unchanged when nothing needs protection', () => {
    const { masked, originals } = protect('plain text only');
    expect(masked).toBe('plain text only');
    expect(originals).toEqual([]);
  });
});

describe('rehydrate', () => {
  it('round-trips protect → rehydrate', () => {
    const text = 'check `code` and https://x.io and <@1> done';
    const { masked, originals } = protect(text);
    expect(rehydrate(masked, originals)).toBe(text);
  });

  it('round-trips literal placeholder-like tokens', () => {
    const text = 'weird ⟦7⟧ and ⟦0⟧ tokens';
    const { masked, originals } = protect(text);
    expect(rehydrate(masked, originals)).toBe(text);
  });

  it('throws on missing placeholder', () => {
    const { originals } = protect('a `x` b `y`');
    expect(() => rehydrate('only ⟦0⟧ survived', originals)).toThrow(PlaceholderIntegrityError);
    try {
      rehydrate('only ⟦0⟧ survived', originals);
    } catch (err) {
      expect((err as PlaceholderIntegrityError).detail).toEqual({ kind: 'missing', missing: [1] });
    }
  });

  it('throws on duplicated placeholder', () => {
    const { originals } = protect('a `x` b');
    expect(() => rehydrate('⟦0⟧ and again ⟦0⟧', originals)).toThrow(PlaceholderIntegrityError);
  });

  it('throws on out-of-range placeholder', () => {
    const { originals } = protect('a `x` b');
    expect(() => rehydrate('⟦0⟧ plus ⟦5⟧', originals)).toThrow(PlaceholderIntegrityError);
  });

  it('does not re-scan substituted originals', () => {
    // originals[0] itself looks like a placeholder; substitution must not recurse
    const result = rehydrate('text ⟦0⟧ end', ['⟦9⟧']);
    expect(result).toBe('text ⟦9⟧ end');
  });
});

describe('toHtmlPayload / fromHtmlPayload', () => {
  it('wraps placeholders in translate="no" spans and escapes the rest', () => {
    const payload = toHtmlPayload('1 < 2 & ⟦0⟧ > done');
    expect(payload).toBe('1 &lt; 2 &amp; <span translate="no">⟦0⟧</span> &gt; done');
  });

  it('round-trips payload encoding', () => {
    const masked = 'a < b & c > d ⟦0⟧ tail ⟦1⟧';
    expect(fromHtmlPayload(toHtmlPayload(masked))).toBe(masked);
  });

  it('strips wrapper spans with altered attributes', () => {
    expect(fromHtmlPayload('x <span class="z">⟦0⟧</span> y')).toBe('x ⟦0⟧ y');
  });

  it('tolerates spans dropped by the provider', () => {
    expect(fromHtmlPayload('x ⟦0⟧ y')).toBe('x ⟦0⟧ y');
  });

  it('unescapes html entities including quotes', () => {
    expect(fromHtmlPayload('&quot;hi&quot; &#39;there&#39; &amp;&lt;&gt;')).toBe(
      '"hi" \'there\' &<>',
    );
  });
});
