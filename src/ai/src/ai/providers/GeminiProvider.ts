/**
 * @file Adapter for Google's Gemini API. Built with raw fetch.
 *
 * Shape differences from OpenAI/Claude worth calling out:
 *  1. Gemini uses roles "user" and "model" (not "assistant") — this
 *     adapter maps LLMMessage's "assistant" role to "model".
 *  2. System prompts go in a top-level `systemInstruction` field, like
 *     Claude, not inline in the turns array.
 *  3. Auth is a `key` query parameter, not a header.
 *
 * IMPORTANT: `model` has no default — pass the exact model slug. Verify
 * against https://ai.google.dev/gemini-api/docs before deploying.
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

export interface GeminiProviderOptions {
  apiKey: string;
  model: string;
  embeddingModel?: string;
  baseUrl?: string;
}

interface GeminiPart {
  text?: string;
}

interface GeminiGenerateResponse {
  candidates: Array<{ content: { parts: GeminiPart[] } }>;
  usageMetadata: { promptTokenCount: number; candidatesTokenCount: number };
  modelVersion?: string;
}

interface GeminiEmbedResponse {
  embedding: { values: number[] };
}

export class GeminiProvider implements ILLMProvider {
  readonly name = 'gemini';
  private readonly baseUrl: string;
  private readonly embeddingModel: string;

  constructor(private readonly options: GeminiProviderOptions) {
    this.baseUrl = options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    this.embeddingModel = options.embeddingModel ?? 'text-embedding-004';
  }

  /** Gemini roles are "user"/"model"; splits out system messages into systemInstruction. */
  private buildBody(messages: LLMMessage[], options: LLMGenerateOptions, jsonMode: boolean) {
    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
    const turns = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      contents: turns.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.2,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    };
    if (systemParts.length > 0) {
      body.systemInstruction = { parts: [{ text: systemParts.join('\n\n') }] };
    }
    return body;
  }

  private url(path: string, extraQuery = ''): string {
    return `${this.baseUrl}/models/${this.options.model}${path}?key=${this.options.apiKey}${extraQuery}`;
  }

  async generate(messages: LLMMessage[], options: LLMGenerateOptions = {}): Promise<LLMResponse> {
    const body = this.buildBody(messages, options, options.jsonMode ?? false);

    const data = await fetchJson<GeminiGenerateResponse>({
      providerName: this.name,
      url: this.url(':generateContent'),
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      timeoutMs: options.timeoutMs ?? 15_000,
    });

    const text = data.candidates[0]?.content.parts.map((p) => p.text ?? '').join('') ?? '';

    return {
      content: text,
      usage: {
        inputTokens: data.usageMetadata.promptTokenCount,
        outputTokens: data.usageMetadata.candidatesTokenCount,
      },
      providerName: this.name,
      model: data.modelVersion ?? this.options.model,
    };
  }

  async *stream(
    messages: LLMMessage[],
    options: LLMGenerateOptions = {},
  ): AsyncIterable<LLMStreamChunk> {
    const body = this.buildBody(messages, options, options.jsonMode ?? false);

    const response = await fetchStream({
      providerName: this.name,
      url: this.url(':streamGenerateContent', '&alt=sse'),
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      timeoutMs: options.timeoutMs ?? 15_000,
    });

    for await (const raw of parseSSE(response)) {
      const parsed = JSON.parse(raw) as GeminiGenerateResponse;
      const delta = parsed.candidates[0]?.content.parts.map((p) => p.text ?? '').join('') ?? '';
      if (delta.length > 0) {
        yield { contentDelta: delta, done: false };
      }
    }
    yield { contentDelta: '', done: true };
  }

  async embeddings(text: string): Promise<EmbeddingResult> {
    const data = await fetchJson<GeminiEmbedResponse>({
      providerName: this.name,
      url: `${this.baseUrl}/models/${this.embeddingModel}:embedContent?key=${this.options.apiKey}`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
      },
      timeoutMs: 15_000,
    });

    return { vector: data.embedding.values, model: this.embeddingModel };
  }

  async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await fetchJson({
        providerName: this.name,
        url: `${this.baseUrl}/models/${this.options.model}?key=${this.options.apiKey}`,
        init: { method: 'GET' },
        timeoutMs: 5_000,
      });
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }
}
