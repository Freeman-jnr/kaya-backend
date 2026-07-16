import { describe, it, expect } from 'vitest';
import {
  AgentError,
  UnknownIntentError,
  LowConfidenceError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  MalformedOutputError,
  ToolValidationError,
  ToolExecutionError,
  ContextRetrievalError,
  isAgentError,
} from '../core/AgentError';

describe('AgentError hierarchy', () => {
  it('every subclass is an instanceof AgentError and Error', () => {
    const errors: AgentError[] = [
      new UnknownIntentError('gibberish message'),
      new LowConfidenceError('record_payment', 0.3),
      new ProviderTimeoutError('openai', 5000),
      new ProviderUnavailableError('gemini'),
      new MalformedOutputError('{not json'),
      new ToolValidationError('PaymentTool', ['amount is required']),
      new ToolExecutionError('PaymentTool'),
      new ContextRetrievalError(),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(AgentError);
      expect(err).toBeInstanceOf(Error);
      expect(typeof err.code).toBe('string');
      expect(typeof err.recoverable).toBe('boolean');
    }
  });

  it('recovery-table classification matches spec exactly', () => {
    // Recoverable: clarify / retry / fallback / repair
    expect(new UnknownIntentError('x').recoverable).toBe(true);
    expect(new LowConfidenceError('x', 0.2).recoverable).toBe(true);
    expect(new ProviderTimeoutError('openai', 1000).recoverable).toBe(true);
    expect(new ProviderUnavailableError('openai').recoverable).toBe(true);
    expect(new MalformedOutputError('{}').recoverable).toBe(true);
    expect(new ToolValidationError('T', []).recoverable).toBe(true);

    // Not recoverable by the pipeline's built-in strategies — surfaced as hard failures
    expect(new ToolExecutionError('T').recoverable).toBe(false);
    expect(new ContextRetrievalError().recoverable).toBe(false);
  });

  it('isAgentError narrows unknown correctly', () => {
    const err: unknown = new LowConfidenceError('record_payment', 0.4, 'amount');
    expect(isAgentError(err)).toBe(true);
    expect(isAgentError(new Error('plain'))).toBe(false);
    expect(isAgentError('not an error')).toBe(false);
  });

  it('preserves cause for debugging chained failures', () => {
    const original = new Error('network reset');
    const wrapped = new ProviderUnavailableError('claude', original);
    expect(wrapped.cause).toBe(original);
  });

  it('LowConfidenceError carries the missing field when provided', () => {
    const err = new LowConfidenceError('record_expense', 0.55, 'amount');
    expect(err.missingField).toBe('amount');
  });
});
