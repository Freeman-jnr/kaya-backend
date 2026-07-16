/**
 * @file ProviderRouter implements ILLMProvider itself, so ReasoningEngine
 * (Module 11) can depend on a single ILLMProvider without knowing it's
 * actually talking to a fallback chain — this is what makes "the AI Agent
 * should work regardless of provider" true even when a provider is down.
 *
 * Fallback rule: only PROVIDER_TIMEOUT, PROVIDER_UNAVAILABLE, and
 * CAPABILITY_UNSUPPORTED (e.g. Claude has no embeddings endpoint) cause
 * the router to try the next provider in order. Any other error (e.g. a
 * malformed response from a provider that otherwise responded) is NOT
 * silently retried on a different provider — content-shape problems are
 * ReasoningEngine's concern (repair/re-prompt), not a routing concern.
 */

import {
  ILLMProvider,
  LLMGenerateOptions,
  LLMMessage,
  LLMResponse,
  LLMStreamChunk,
  EmbeddingResult,
  ProviderHealth,
} from '../providers/ILLMProvider';
import { isAgentError, ProviderUnavailableError } from '../core/AgentError';
import { ILogger } from '../telemetry/Logger';

const FALLBACK_CODES = new Set(['PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE', 'CAPABILITY_UNSUPPORTED']);

export class ProviderRouter implements ILLMProvider {
  readonly name = 'provider-router';

  constructor(
    /** Ordered by preference — index 0 is tried first. */
    private readonly providers: ILLMProvider[],
    private readonly logger: ILogger,
  ) {
    if (providers.length === 0) {
      throw new Error('ProviderRouter requires at least one provider');
    }
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse> {
    return this.withFallback('generate', (p) => p.generate(messages, options));
  }

  async embeddings(text: string): Promise<EmbeddingResult> {
    return this.withFallback('embeddings', (p) => p.embeddings(text));
  }

  /**
   * Streaming fallback only applies before the first chunk is yielded —
   * once a provider has started streaming content to the caller, switching
   * providers mid-stream would produce incoherent output, so a failure
   * after the first chunk propagates immediately rather than restarting
   * on a different provider.
   */
  async *stream(messages: LLMMessage[], options?: LLMGenerateOptions): AsyncIterable<LLMStreamChunk> {
    let lastErr: unknown;

    for (const provider of this.providers) {
      try {
        const iterator = provider.stream(messages, options)[Symbol.asyncIterator]();
        const first = await iterator.next();
        if (first.done) return;
        yield first.value;

        for (;;) {
          const next = await iterator.next();
          if (next.done) return;
          yield next.value;
        }
      } catch (err) {
        lastErr = err;
        if (isAgentError(err) && FALLBACK_CODES.has(err.code)) {
          this.logger.warn(
            { provider: provider.name, code: err.code },
            'Provider failed before streaming started, trying next provider',
          );
          continue;
        }
        throw err;
      }
    }

    throw new ProviderUnavailableError('all-providers', lastErr);
  }

  /** Returns the health of the first provider that responds healthy; if none are, reports the first provider's failure. */
  async healthCheck(): Promise<ProviderHealth> {
    let firstFailure: ProviderHealth | undefined;
    for (const provider of this.providers) {
      const health = await provider.healthCheck();
      if (health.healthy) return health;
      firstFailure ??= health;
    }
    return firstFailure ?? { healthy: false, error: 'no providers configured' };
  }

  private async withFallback<T>(
    opName: string,
    call: (provider: ILLMProvider) => Promise<T>,
  ): Promise<T> {
    let lastErr: unknown;

    for (const provider of this.providers) {
      try {
        return await call(provider);
      } catch (err) {
        lastErr = err;
        if (isAgentError(err) && FALLBACK_CODES.has(err.code)) {
          this.logger.warn(
            { provider: provider.name, code: err.code, opName },
            `Provider failed on ${opName}, trying next provider`,
          );
          continue;
        }
        throw err;
      }
    }

    throw new ProviderUnavailableError('all-providers', lastErr);
  }
}

/**
 * Convenience factory: builds a ProviderRouter from a name->provider map
 * and a preferred order (typically AgentConfig.providerFallbackOrder).
 * Silently skips any name in `order` that has no corresponding provider,
 * so config can list providers you haven't wired up yet.
 */
export function buildProviderRouter(
  providerMap: Record<string, ILLMProvider>,
  order: string[],
  logger: ILogger,
): ProviderRouter {
  const ordered = order.map((name) => providerMap[name]).filter((p): p is ILLMProvider => p !== undefined);
  return new ProviderRouter(ordered, logger);
}
