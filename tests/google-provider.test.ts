import { describe, expect, it } from 'vitest';
import { createGoogleProvider } from '../src/providers/google.js';
import { ProviderError } from '../src/providers/types.js';

interface CapturedCall {
  url: string;
  init: RequestInit;
}

// Builds a fresh Response per call — a Response body is single-use, and
// some tests issue more than one request against the same fake.
const providerWith = (
  status: number,
  body: unknown,
): { provider: ReturnType<typeof createGoogleProvider>; calls: CapturedCall[] } => {
  const calls: CapturedCall[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
  return { provider: createGoogleProvider({ apiKey: 'secret-key', fetchImpl }), calls };
};

const SUCCESS_BODY = {
  data: { translations: [{ translatedText: 'hello', detectedSourceLanguage: 'fr' }] },
};

describe('createGoogleProvider — request shape', () => {
  it('sends the API key in a header, never in the URL', async () => {
    const { provider, calls } = providerWith(200, SUCCESS_BODY);
    await provider.translate({ text: 'bonjour', targetLanguage: 'en' });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).not.toContain('secret-key');
    expect(calls[0]!.url).not.toContain('key=');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe('secret-key');
  });

  it('omits source for auto-detect and includes it when explicit', async () => {
    const { provider, calls } = providerWith(200, SUCCESS_BODY);
    await provider.translate({ text: 'a', targetLanguage: 'en' });
    await provider.translate({ text: 'a', sourceLanguage: 'fr', targetLanguage: 'en' });

    const bodyAuto = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>;
    const bodyExplicit = JSON.parse(String(calls[1]!.init.body)) as Record<string, unknown>;
    expect(bodyAuto.source).toBeUndefined();
    expect(bodyAuto.format).toBe('html');
    expect(bodyExplicit.source).toBe('fr');
  });

  it('rejects unsupported language pairs before any network call', async () => {
    const { provider, calls } = providerWith(200, SUCCESS_BODY);
    await expect(provider.translate({ text: 'a', targetLanguage: 'de' })).rejects.toMatchObject({
      kind: 'unsupported_language',
    });
    expect(calls).toHaveLength(0);
  });
});

describe('createGoogleProvider — response handling', () => {
  it('parses a successful translation with detected source', async () => {
    const { provider } = providerWith(200, SUCCESS_BODY);
    const result = await provider.translate({ text: 'bonjour', targetLanguage: 'en' });
    expect(result).toMatchObject({
      provider: 'google',
      sourceLanguage: 'fr',
      targetLanguage: 'en',
      translatedText: 'hello',
      detected: true,
      billedCharacters: 'bonjour'.length,
    });
  });

  it('throws unknown when translatedText is missing', async () => {
    const { provider } = providerWith(200, { data: { translations: [{}] } });
    await expect(provider.translate({ text: 'a', targetLanguage: 'en' })).rejects.toMatchObject({
      kind: 'unknown',
    });
  });

  it.each([
    [400, { error: { message: 'Invalid target language' } }, 'unsupported_language'],
    [400, { error: { message: 'Bad payload' } }, 'pre_send_validation'],
    [401, {}, 'auth'],
    [403, {}, 'auth'],
    [429, {}, 'rate_limited'],
    [500, {}, 'transient'],
    [503, {}, 'transient'],
    [418, {}, 'unknown'],
  ])('classifies HTTP %i as %s', async (status, body, kind) => {
    const { provider } = providerWith(status, body);
    await expect(provider.translate({ text: 'a', targetLanguage: 'en' })).rejects.toMatchObject({
      kind,
    });
  });

  it('classifies a timeout as transient', async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    const provider = createGoogleProvider({ apiKey: 'k', fetchImpl, timeoutMs: 10 });

    const attempt = provider.translate({ text: 'a', targetLanguage: 'en' });
    await expect(attempt).rejects.toBeInstanceOf(ProviderError);
    await expect(attempt).rejects.toMatchObject({ kind: 'transient' });
    await expect(attempt).rejects.toThrow(/timed out/);
  });
});
