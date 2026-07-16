/**
 * @file Adapter for OpenAI's Chat Completions API. Built with raw fetch —
 * no `openai` SDK dependency — per the "everything besides LLM calls is
 * built from scratch" constraint.
 *
 * IMPORTANT: `model` has no default — pass the exact model slug you want
 * (e.g. "gpt-4.1", "gpt-4o-mini"). Model names change over time; hardcoding
 * a default here risks silently shipping a stale/deprecated one.
 *
 * Endpoint shapes reflect OpenAI's Chat Completions API as of this
 * writing — verify against https://platform.openai.com/docs before
 * relying on this in production, since providers do change response shapes.
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

export interface OpenAIProviderOptions {
  apiKey: string;
  model: string;
  embeddingModel?: string;
  baseUrl?: string;
}

interface OpenAIChatResponse {
  choices: Array<{ message: { content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number };
  model: string;
}

interface OpenAIStreamChunk {
  choices: Array<{ delta: { content?: string }; finish_reason: string | null }>;
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  model: string;
}

export class OpenAIProvider implements ILLMProvider {
  readonly name = 'openai';
  private readonly baseUrl: string;
  private readonly embeddingModel: string;

  constructor(private readonly options: OpenAIProviderOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
    this.embeddingModel = options.embeddingModel ?? 'text-embedding-3-small';
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.options.apiKey}`,
    };
  }

  async generate(messages: LLMMessage[], options: LLMGenerateOptions = {}): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.options.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.2,
    };
    if (options.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const data = await fetchJson<OpenAIChatResponse>({
      providerName: this.name,
      url: `${this.baseUrl}/chat/completions`,
      init: { method: 'POST', headers: this.headers(), body: JSON.stringify(body) },
      timeoutMs: options.timeoutMs ?? 15_000,
    });

    return {
      content: data.choices[0]?.message.content ?? '',
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      },
      providerName: this.name,
      model: data.model,
    };
  }

  async *stream(
    messages: LLMMessage[],
    options: LLMGenerateOptions = {},
  ): AsyncIterable<LLMStreamChunk> {
    const body: Record<string, unknown> = {
      model: this.options.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.2,
      stream: true,
    };

    const response = await fetchStream({
      providerName: this.name,
      url: `${this.baseUrl}/chat/completions`,
      init: { method: 'POST', headers: this.headers(), body: JSON.stringify(body) },
      timeoutMs: options.timeoutMs ?? 15_000,
    });

    for await (const raw of parseSSE(response)) {
      const parsed = JSON.parse(raw) as OpenAIStreamChunk;
      const delta = parsed.choices[0]?.delta.content ?? '';
      const done = parsed.choices[0]?.finish_reason != null;
      if (delta.length > 0 || done) {
        yield { contentDelta: delta, done };
      }
    }
  }

  async embeddings(text: string): Promise<EmbeddingResult> {
    const data = await fetchJson<OpenAIEmbeddingResponse>({
      providerName: this.name,
      url: `${this.baseUrl}/embeddings`,
      init: {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ model: this.embeddingModel, input: text }),
      },
      timeoutMs: 15_000,
    });

    return { vector: data.data[0]?.embedding ?? [], model: data.model };
  }

  async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await fetchJson({
        providerName: this.name,
        url: `${this.baseUrl}/models`,
        init: { method: 'GET', headers: this.headers() },
        timeoutMs: 5_000,
      });
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }
}
