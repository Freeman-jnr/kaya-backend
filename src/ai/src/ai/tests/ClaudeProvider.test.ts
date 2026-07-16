import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeProvider } from '../providers/ClaudeProvider';
import { ProviderCapabilityUnsupportedError, ProviderUnavailableError } from '../core/AgentError';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('ClaudeProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const provider = () => new ClaudeProvider({ apiKey: 'sk-ant-test', model: 'claude-sonnet-5' });

  it('generate() sends x-api-key and anthropic-version headers', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: 'Payment recorded.' }],
        usage: { input_tokens: 8, output_tokens: 4 },
        model: 'claude-sonnet-5',
      }),
    );

    const result = await provider().generate([{ role: 'user', content: 'Mary paid 30000' }]);
    expect(result.content).toBe('Payment recorded.');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk-ant-test');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('splits a system-role message into the top-level `system` field, not the messages array', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        model: 'claude-sonnet-5',
      }),
    );

    await provider().generate([
      { role: 'system', content: 'You are Kaya, a business assistant.' },
      { role: 'user', content: 'Mary paid 30000' },
    ]);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.system).toContain('You are Kaya');
    expect(body.messages).toEqual([{ role: 'user', content: 'Mary paid 30000' }]);
  });

  it('appends a JSON-only instruction to system when jsonMode is true', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: '{}' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        model: 'claude-sonnet-5',
      }),
    );

    await provider().generate([{ role: 'user', content: 'x' }], { jsonMode: true });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.system).toMatch(/valid JSON/i);
  });

  it('embeddings() throws ProviderCapabilityUnsupportedError without making a request', async () => {
    await expect(provider().embeddings('hello')).rejects.toBeInstanceOf(
      ProviderCapabilityUnsupportedError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a non-2xx response to ProviderUnavailableError', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'invalid_api_key' }, false, 401));
    await expect(provider().generate([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('concatenates multiple text content blocks in the response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        content: [
          { type: 'text', text: 'Part one. ' },
          { type: 'text', text: 'Part two.' },
        ],
        usage: { input_tokens: 1, output_tokens: 1 },
        model: 'claude-sonnet-5',
      }),
    );
    const result = await provider().generate([{ role: 'user', content: 'x' }]);
    expect(result.content).toBe('Part one. Part two.');
  });
});
