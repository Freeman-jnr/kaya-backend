import { describe, it, expect, vi } from 'vitest';
import { ProviderRouter, buildProviderRouter } from '../reasoning/ProviderRouter';
import { ILLMProvider, LLMResponse, ProviderHealth } from '../providers/ILLMProvider';
import {
  ProviderTimeoutError,
  ProviderUnavailableError,
  ProviderCapabilityUnsupportedError,
  MalformedOutputError,
} from '../core/AgentError';
import { createSilentLogger } from './testHelpers';

function mockProvider(name: string): ILLMProvider {
  return {
    name,
    generate: vi.fn(),
    stream: vi.fn(),
    embeddings: vi.fn(),
    healthCheck: vi.fn(),
  };
}

const okResponse = (providerName: string): LLMResponse => ({
  content: 'ok',
  usage: { inputTokens: 1, outputTokens: 1 },
  providerName,
  model: 'test-model',
});

describe('ProviderRouter — generate() fallback', () => {
  it('uses the first provider when it succeeds, without touching the others', async () => {
    const a = mockProvider('a');
    const b = mockProvider('b');
    (a.generate as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse('a'));

    const router = new ProviderRouter([a, b], createSilentLogger());
    const result = await router.generate([{ role: 'user', content: 'hi' }]);

    expect(result.providerName).toBe('a');
    expect(b.generate).not.toHaveBeenCalled();
  });

  it('falls back to the next provider on ProviderTimeoutError', async () => {
    const a = mockProvider('a');
    const b = mockProvider('b');
    (a.generate as ReturnType<typeof vi.fn>).mockRejectedValue(new ProviderTimeoutError('a', 5000));
    (b.generate as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse('b'));

    const router = new ProviderRouter([a, b], createSilentLogger());
    const result = await router.generate([{ role: 'user', content: 'hi' }]);

    expect(result.providerName).toBe('b');
  });

  it('falls back to the next provider on ProviderUnavailableError', async () => {
    const a = mockProvider('a');
    const b = mockProvider('b');
    (a.generate as ReturnType<typeof vi.fn>).mockRejectedValue(new ProviderUnavailableError('a'));
    (b.generate as ReturnType<typeof vi.fn>).mockResolvedValue(okResponse('b'));

    const router = new ProviderRouter([a, b], createSilentLogger());
    const result = await router.generate([{ role: 'user', content: 'hi' }]);

    expect(result.providerName).toBe('b');
  });

  it('throws ProviderUnavailableError("all-providers") when every provider fails', async () => {
    const a = mockProvider('a');
    const b = mockProvider('b');
    (a.generate as ReturnType<typeof vi.fn>).mockRejectedValue(new ProviderTimeoutError('a', 5000));
    (b.generate as ReturnType<typeof vi.fn>).mockRejectedValue(new ProviderUnavailableError('b'));

    const router = new ProviderRouter([a, b], createSilentLogger());
    await expect(router.generate([{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('does NOT fall back on a non-provider error like MalformedOutputError', async () => {
    const a = mockProvider('a');
    const b = mockProvider('b');
    (a.generate as ReturnType<typeof vi.fn>).mockRejectedValue(new MalformedOutputError('{bad'));

    const router = new ProviderRouter([a, b], createSilentLogger());
    await expect(router.generate([{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(
      MalformedOutputError,
    );
    expect(b.generate).not.toHaveBeenCalled();
  });
});

describe('ProviderRouter — embeddings() fallback', () => {
  it('falls back when a provider throws ProviderCapabilityUnsupportedError (e.g. Claude has no embeddings)', async () => {
    const claude = mockProvider('claude');
    const openai = mockProvider('openai');
    (claude.embeddings as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ProviderCapabilityUnsupportedError('claude', 'embeddings'),
    );
    (openai.embeddings as ReturnType<typeof vi.fn>).mockResolvedValue({ vector: [0.1], model: 'text-embedding-3-small' });

    const router = new ProviderRouter([claude, openai], createSilentLogger());
    const result = await router.embeddings('hello');

    expect(result.vector).toEqual([0.1]);
  });
});

describe('ProviderRouter — healthCheck()', () => {
  it('returns the first healthy provider result', async () => {
    const a = mockProvider('a');
    const b = mockProvider('b');
    (a.healthCheck as ReturnType<typeof vi.fn>).mockResolvedValue({ healthy: false, error: 'down' } satisfies ProviderHealth);
    (b.healthCheck as ReturnType<typeof vi.fn>).mockResolvedValue({ healthy: true, latencyMs: 20 } satisfies ProviderHealth);

    const router = new ProviderRouter([a, b], createSilentLogger());
    const health = await router.healthCheck();

    expect(health.healthy).toBe(true);
  });

  it('reports the first failure when all providers are unhealthy', async () => {
    const a = mockProvider('a');
    (a.healthCheck as ReturnType<typeof vi.fn>).mockResolvedValue({ healthy: false, error: 'down' } satisfies ProviderHealth);

    const router = new ProviderRouter([a], createSilentLogger());
    const health = await router.healthCheck();

    expect(health.healthy).toBe(false);
    expect(health.error).toBe('down');
  });
});

describe('ProviderRouter — stream() fallback', () => {
  it('falls back to the next provider if the first fails before yielding any chunk', async () => {
    const a = mockProvider('a');
    const b = mockProvider('b');
    (a.stream as ReturnType<typeof vi.fn>).mockImplementation(async function* () {
      throw new ProviderUnavailableError('a');
    });
    (b.stream as ReturnType<typeof vi.fn>).mockImplementation(async function* () {
      yield { contentDelta: 'hello', done: false };
      yield { contentDelta: '', done: true };
    });

    const router = new ProviderRouter([a, b], createSilentLogger());
    const chunks = [];
    for await (const chunk of router.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk);
    }

    expect(chunks[0]?.contentDelta).toBe('hello');
  });
});

describe('buildProviderRouter', () => {
  it('orders providers according to the given order and skips unknown names', () => {
    const openai = mockProvider('openai');
    const claude = mockProvider('claude');
    const router = buildProviderRouter(
      { openai, claude },
      ['claude', 'gemini', 'openai'], // 'gemini' not in map -> skipped
      createSilentLogger(),
    );
    expect(router).toBeInstanceOf(ProviderRouter);
  });

  it('throws if the resulting provider list is empty', () => {
    expect(() => buildProviderRouter({}, ['nonexistent'], createSilentLogger())).toThrow();
  });
});
