import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider } from '../providers/GeminiProvider';
import { ProviderUnavailableError } from '../core/AgentError';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('GeminiProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const provider = () => new GeminiProvider({ apiKey: 'gm-test', model: 'gemini-2.0-flash' });

  it('generate() maps assistant role to "model" and includes the API key as a query param', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: 'Payment recorded.' }] } }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 6 },
        modelVersion: 'gemini-2.0-flash',
      }),
    );

    const result = await provider().generate([
      { role: 'assistant', content: 'Got it.' },
      { role: 'user', content: 'Mary paid 30000' },
    ]);

    expect(result.content).toBe('Payment recorded.');
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 6 });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('key=gm-test');
    expect(url).toContain(':generateContent');
    const body = JSON.parse(init.body);
    expect(body.contents[0].role).toBe('model');
    expect(body.contents[1].role).toBe('user');
  });

  it('moves system-role messages into systemInstruction, not contents', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: 'ok' }] } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      }),
    );

    await provider().generate([
      { role: 'system', content: 'You are Kaya.' },
      { role: 'user', content: 'hi' },
    ]);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.systemInstruction.parts[0].text).toBe('You are Kaya.');
    expect(body.contents).toHaveLength(1);
    expect(body.contents[0].role).toBe('user');
  });

  it('sets responseMimeType to application/json when jsonMode is true', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: '{}' }] } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
      }),
    );
    await provider().generate([{ role: 'user', content: 'x' }], { jsonMode: true });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('maps a non-2xx response to ProviderUnavailableError', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'quota exceeded' }, false, 429));
    await expect(provider().generate([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('embeddings() posts to the embedContent endpoint and returns the vector', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ embedding: { values: [0.4, 0.5] } }));
    const result = await provider().embeddings('hello');
    expect(result.vector).toEqual([0.4, 0.5]);
    expect(fetchMock.mock.calls[0]![0]).toContain(':embedContent');
  });
});
