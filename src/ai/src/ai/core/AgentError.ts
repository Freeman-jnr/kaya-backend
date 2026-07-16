/**
 * @file Typed error hierarchy. AgentPipeline (Module 3) catches these
 * centrally and maps each type to the recovery behavior from spec:
 *   UnknownIntentError / LowConfidenceError -> ask for clarification / one missing detail
 *   ProviderTimeoutError                    -> retry
 *   ProviderUnavailableError                -> fallback to another provider
 *   MalformedOutputError                    -> attempt JSON repair, else re-prompt
 *   ToolValidationError / ToolExecutionError -> surface as a specific, actionable message
 *
 * Every subclass carries `recoverable` so AgentPipeline can decide whether
 * to attempt recovery at all versus surface a hard failure immediately.
 */

export abstract class AgentError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;

  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnknownIntentError extends AgentError {
  readonly code = 'UNKNOWN_INTENT';
  readonly recoverable = true;
  constructor(public readonly rawMessage: string) {
    super(`Could not classify intent for message: "${rawMessage}"`);
  }
}

export class LowConfidenceError extends AgentError {
  readonly code = 'LOW_CONFIDENCE';
  readonly recoverable = true;
  constructor(
    public readonly intent: string,
    public readonly confidence: number,
    public readonly missingField?: string,
  ) {
    super(`Low confidence (${confidence}) classifying intent "${intent}"`);
  }
}

export class ProviderTimeoutError extends AgentError {
  readonly code = 'PROVIDER_TIMEOUT';
  readonly recoverable = true;
  constructor(public readonly providerName: string, public readonly timeoutMs: number) {
    super(`Provider "${providerName}" timed out after ${timeoutMs}ms`);
  }
}

export class ProviderUnavailableError extends AgentError {
  readonly code = 'PROVIDER_UNAVAILABLE';
  readonly recoverable = true;
  constructor(public readonly providerName: string, cause?: unknown) {
    super(`Provider "${providerName}" is unavailable`, cause);
  }
}

export class MalformedOutputError extends AgentError {
  readonly code = 'MALFORMED_OUTPUT';
  readonly recoverable = true;
  constructor(public readonly rawOutput: string, cause?: unknown) {
    super('LLM output failed schema validation', cause);
  }
}

export class ToolValidationError extends AgentError {
  readonly code = 'TOOL_VALIDATION_FAILED';
  readonly recoverable = true;
  constructor(public readonly toolName: string, public readonly errors: string[]) {
    super(`Validation failed for tool "${toolName}": ${errors.join(', ')}`);
  }
}

export class ToolExecutionError extends AgentError {
  readonly code = 'TOOL_EXECUTION_FAILED';
  readonly recoverable = false;
  constructor(public readonly toolName: string, cause?: unknown) {
    super(`Execution failed for tool "${toolName}"`, cause);
  }
}

export class ProviderCapabilityUnsupportedError extends AgentError {
  readonly code = 'CAPABILITY_UNSUPPORTED';
  readonly recoverable = true;
  constructor(public readonly providerName: string, public readonly capability: string) {
    super(`Provider "${providerName}" does not support capability "${capability}"`);
  }
}

export class ContextRetrievalError extends AgentError {
  readonly code = 'CONTEXT_RETRIEVAL_FAILED';
  readonly recoverable = false;
  constructor(cause?: unknown) {
    super('Failed to retrieve business context', cause);
  }
}

/** Type guard for narrowing `unknown` caught errors to AgentError. */
export function isAgentError(err: unknown): err is AgentError {
  return err instanceof AgentError;
}
