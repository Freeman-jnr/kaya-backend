/**
 * @file The provider-agnostic LLM contract. ReasoningEngine (Module 11)
 * and ProviderRouter depend only on this interface — never on a concrete
 * OpenAI/Gemini/Claude SDK type — so providers are fully swappable.
 */

export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMGenerateOptions {
  /** Max tokens for the completion. Providers map this to their own param name. */
  maxTokens?: number;
  temperature?: number;
  /** If set, provider should attempt to constrain output to valid JSON matching this description. Used for structured extraction/classification calls. */
  jsonMode?: boolean;
  /** Abort after this many ms. ReasoningEngine uses this to implement the "provider timeout -> retry" recovery rule. */
  timeoutMs?: number;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResponse {
  content: string;
  usage: LLMUsage;
  /** Which provider actually served this response — relevant after fallback routing. */
  providerName: string;
  /** Provider's own model identifier, e.g. "gpt-4.1", "gemini-2.0-flash", "claude-sonnet-5". */
  model: string;
}

export interface LLMStreamChunk {
  contentDelta: string;
  done: boolean;
}

export interface EmbeddingResult {
  vector: number[];
  model: string;
}

export interface ProviderHealth {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Every LLM provider adapter implements this. No method throws for
 * "provider unreachable" — health/failure is communicated via return
 * values or specific AgentError subclasses (ProviderUnavailableError,
 * ProviderTimeoutError) so ProviderRouter can react deterministically.
 */
export interface ILLMProvider {
  readonly name: string;

  generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMResponse>;

  stream(
    messages: LLMMessage[],
    options?: LLMGenerateOptions,
  ): AsyncIterable<LLMStreamChunk>;

  embeddings(text: string): Promise<EmbeddingResult>;

  healthCheck(): Promise<ProviderHealth>;
}
