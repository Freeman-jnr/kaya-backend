/**
 * @file Adapter for Anthropic's Messages API. Built with raw fetch.
 *
 * Two shape differences from OpenAI worth calling out because they're easy
 * to get wrong:
 *  1. Claude's Messages API takes `system` as a top-level field, NOT as a
 *     message with role "system" inside the messages array. This adapter
 *     extracts any `system`-role LLMMessages and joins them into that field.
 *  2. Claude has no public embeddings endpoint. `embeddings()` throws
 *     ProviderCapabilityUnsupportedError — ProviderRouter (this module)
 *     is expected to skip to the next provider in the fallback order for
 *     embedding calls specifically.
 *
 * IMPORTANT: `model` has no default — pass the exact model slug you're
 * targeting. Verify against https://docs.claude.com before deploying,
 * since model identifiers are versioned and change over time.
 */

import {
  ILLMProvider,
  LLMGenerateOptions,
  LLMMessage,
  LLMResponse,
  LLMStreamChunk,
  EmbeddingResult,
  ProviderHealth,
} from './ILLMProvider';
import { fetchJson, fetchStream } from './httpUtil';
import { parseSSE } from './sseUtil';
import { ProviderCapabilityUnsupportedError } from '../core/AgentError';

export interface ClaudeProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  /** Anthropic API version header. */
  apiVersion?: string;
}

interface ClaudeMessageResponse {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
  model: string;
}

interface ClaudeStreamEvent {
  type: string;
  delta?: { type: string; text?: string };
}

export class ClaudeProvider implements ILLMProvider {
  readonly name = 'claude';
  private readonly baseUrl: string;
  private readonly apiVersion: string;

  constructor(private readonly options: ClaudeProviderOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.anthropic.com/v1';
    this.apiVersion = options.apiVersion ?? '2023-06-01';
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.options.apiKey,
      'anthropic-version': this.apiVersion,
    };
  }

  /** Splits system-role messages (Claude wants these as a top-level field) from the conversational turns. */
  private splitSystem(messages: LLMMessage[]): { system: string | undefined; turns: LLMMessage[] } {
    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
    const turns = messages.filter((m) => m.role !== 'system');
    return { system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined, turns };
  }

  private buildBody(messages: LLMMessage[], options: LLMGenerateOptions, stream: boolean): Record<string, unknown> {
    const { system, turns } = this.splitSystem(messages);
    const jsonInstruction = options.jsonMode
      ? '\n\nRespond with ONLY valid JSON. No prose, no markdown code fences.'
      : '';

    const body: Record<string, unknown> = {
      model: this.options.model,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.2,
      messages: turns.map((m) => ({ role: m.role, content: m.content })),
      stream,
    };
    if (system || jsonInstruction) {
      body.system = `${system ?? ''}${jsonInstruction}`.trim();
    }
    return body;
  }

  async generate(messages: LLMMessage[], options: LLMGenerateOptions = {}): Promise<LLMResponse> {
    const body = this.buildBody(messages, options, false);

    const data = await fetchJson<ClaudeMessageResponse>({
      providerName: this.name,
      url: `${this.baseUrl}/messages`,
      init: { method: 'POST', headers: this.headers(), body: JSON.stringify(body) },
      timeoutMs: options.timeoutMs ?? 15_000,
    });

    const text = data.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');

    return {
      content: text,
      usage: { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens },
      providerName: this.name,
      model: data.model,
    };
  }

  async *stream(
    messages: LLMMessage[],
    options: LLMGenerateOptions = {},
  ): AsyncIterable<LLMStreamChunk> {
    const body = this.buildBody(messages, options, true);

    const response = await fetchStream({
      providerName: this.name,
      url: `${this.baseUrl}/messages`,
      init: { method: 'POST', headers: this.headers(), body: JSON.stringify(body) },
      timeoutMs: options.timeoutMs ?? 15_000,
    });

    for await (const raw of parseSSE(response)) {
      const event = JSON.parse(raw) as ClaudeStreamEvent;
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        yield { contentDelta: event.delta.text ?? '', done: false };
      } else if (event.type === 'message_stop') {
        yield { contentDelta: '', done: true };
      }
    }
  }

  async embeddings(_text: string): Promise<EmbeddingResult> {
    throw new ProviderCapabilityUnsupportedError(this.name, 'embeddings');
  }

  async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await fetchJson({
        providerName: this.name,
        url: `${this.baseUrl}/messages`,
        init: {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({
            model: this.options.model,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        },
        timeoutMs: 5_000,
      });
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }
}
