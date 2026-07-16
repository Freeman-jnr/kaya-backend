/**
 * @file Central agent configuration: confidence threshold, retry policy,
 * provider preferences. Passed into AgentPipeline; nothing here is
 * hardcoded elsewhere in the framework.
 */

export interface RetryPolicy {
  /** How many times AgentPipeline will re-invoke a stage after a recoverable provider error before giving up. */
  maxStageRetries: number;
  /** Base backoff before a retry, in ms. AgentPipeline does not implement exponential backoff itself (single retry use case) but keeps this for future use. */
  backoffMs: number;
}

export interface AgentConfig {
  /** Below this, IntentClassifier output is treated as LowConfidenceError. Range [0,1]. */
  confidenceThreshold: number;
  /** Passed to ILLMProvider.generate() as LLMGenerateOptions.timeoutMs by ReasoningEngine/EntityExtractor/IntentClassifier. */
  providerTimeoutMs: number;
  retryPolicy: RetryPolicy;
  /** Preferred provider order for ProviderRouter (Module 11), e.g. ['openai', 'claude', 'gemini']. */
  providerFallbackOrder: string[];
  /** Max recent records ContextRetriever fetches per category (orders, payments, etc). */
  contextRecentLimit: number;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  confidenceThreshold: 0.6,
  providerTimeoutMs: 15_000,
  retryPolicy: {
    maxStageRetries: 1,
    backoffMs: 250,
  },
  providerFallbackOrder: ['openai', 'claude', 'gemini'],
  contextRecentLimit: 10,
};

/** Shallow-merges overrides onto DEFAULT_AGENT_CONFIG, deep-merging retryPolicy specifically. */
export function buildAgentConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  if (!overrides) return { ...DEFAULT_AGENT_CONFIG };
  return {
    ...DEFAULT_AGENT_CONFIG,
    ...overrides,
    retryPolicy: {
      ...DEFAULT_AGENT_CONFIG.retryPolicy,
      ...overrides.retryPolicy,
    },
  };
}
