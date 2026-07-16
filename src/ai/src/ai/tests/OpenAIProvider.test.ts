import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { ProviderTimeoutError, ProviderUnavailableError } from '../core/AgentError';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('OpenAIProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const provider = () => new OpenAIProvider({ apiKey: 'sk-test', model: 'gpt-4.1' });

  it('generate() sends the correct request shape and parses the response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: 'Payment recorded.' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        model: 'gpt-4.1',
      }),
    );

    const result = await provider().generate([{ role: 'user', content: 'Mary paid 30000' }]);

    expect(result.content).toBe('Payment recorded.');
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    expect(result.providerName).toBe('openai');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('gpt-4.1');
    expect(body.messages).toEqual([{ role: 'user', content: 'Mary paid 30000' }]);
  });

  it('generate() sets response_format when jsonMode is true', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: '{}' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        model: 'gpt-4.1',
      }),
    );

    await provider().generate([{ role: 'user', content: 'x' }], { jsonMode: true });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('maps a non-2xx response to ProviderUnavailableError', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'bad key' }, false, 401));

    await expect(provider().generate([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('maps an aborted request (timeout) to ProviderTimeoutError', async () => {
    fetchMock.mockImplementation(() => {
      const err = new DOMException('The operation was aborted', 'AbortError');
      return Promise.reject(err);
    });

    await expect(
      provider().generate([{ role: 'user', content: 'x' }], { timeoutMs: 10 }),
    ).rejects.toBeInstanceOf(ProviderTimeoutError);
  });

  it('maps a raw network failure to ProviderUnavailableError', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(provider().generate([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('embeddings() posts to the embeddings endpoint and returns the vector', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: [{ embedding: [0.1, 0.2, 0.3] }], model: 'text-embedding-3-small' }),
    );

    const result = await provider().embeddings('hello');
    expect(result.vector).toEqual([0.1, 0.2, 0.3]);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.openai.com/v1/embeddings');
  });

  it('healthCheck() returns healthy:true on a 200 response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    const health = await provider().healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('healthCheck() returns healthy:false on failure without throwing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 500));
    const health = await provider().healthCheck();
    expect(health.healthy).toBe(false);
    expect(health.error).toBeTruthy();
  });
});
