import { describe, it, expect, vi } from 'vitest';
import { AgentPipeline } from '../core/AgentPipeline';
import { AgentContext } from '../core/AgentContext';
import { DEFAULT_AGENT_CONFIG, buildAgentConfig } from '../core/AgentConfig';
import { IntentName } from '../classifier/Intent';
import {
  LowConfidenceError,
  MalformedOutputError,
  ProviderTimeoutError,
  ToolExecutionError,
  UnknownIntentError,
} from '../core/AgentError';
import { createHappyPathStages, createSilentLogger } from './testHelpers';

function ctx(message = 'Mary paid 30000') {
  return AgentContext.create({ rawMessage: message, businessId: 'biz_1', userId: 'user_1' });
}

describe('AgentPipeline — happy path', () => {
  it('runs all 7 stages in order and returns the final response', async () => {
    const stages = createHappyPathStages();
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());
    const context = ctx();

    const response = await pipeline.run(context);

    expect(response.success).toBe(true);
    expect(response.message).toBe('Payment recorded.');
    expect(stages.intentClassifier.run).toHaveBeenCalledTimes(1);
    expect(stages.entityExtractor.run).toHaveBeenCalledTimes(1);
    expect(stages.contextRetriever.run).toHaveBeenCalledTimes(1);
    expect(stages.reasoningEngine.run).toHaveBeenCalledTimes(1);
    expect(stages.planner.run).toHaveBeenCalledTimes(1);
    expect(stages.toolExecutor.run).toHaveBeenCalledTimes(1);
    expect(stages.responseGenerator.run).toHaveBeenCalledTimes(1);
  });

  it('records a trace event for every successful stage', async () => {
    const stages = createHappyPathStages();
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());
    const context = ctx();

    await pipeline.run(context);

    const stageNames = context.trace.map((t) => t.stage);
    expect(stageNames).toEqual([
      'intent_classification',
      'entity_extraction',
      'context_retrieval',
      'reasoning',
      'planning',
      'tool_execution',
      'response_generation',
    ]);
    expect(context.trace.every((t) => t.outcome === 'success')).toBe(true);
  });
});

describe('AgentPipeline — intent gating', () => {
  it('routes Unknown intent to a clarification response without running later stages', async () => {
    const stages = createHappyPathStages();
    stages.intentClassifier.run = vi
      .fn()
      .mockResolvedValue({ intent: IntentName.Unknown, confidence: 0.9 });
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());

    const response = await pipeline.run(ctx('asdkjhasdkj'));

    expect(response.success).toBe(false);
    expect(response.clarificationRequested).toBe(true);
    expect(stages.entityExtractor.run).not.toHaveBeenCalled();
  });

  it('routes low-confidence classification to a clarification response', async () => {
    const stages = createHappyPathStages();
    stages.intentClassifier.run = vi
      .fn()
      .mockResolvedValue({ intent: IntentName.RecordPayment, confidence: 0.3 });
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());

    const response = await pipeline.run(ctx());

    expect(response.clarificationRequested).toBe(true);
    expect(stages.entityExtractor.run).not.toHaveBeenCalled();
  });

  it('routes GeneralChat to clarification (not actionable) rather than running tools', async () => {
    const stages = createHappyPathStages();
    stages.intentClassifier.run = vi
      .fn()
      .mockResolvedValue({ intent: IntentName.GeneralChat, confidence: 0.9 });
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());

    const response = await pipeline.run(ctx('hello'));

    expect(response.clarificationRequested).toBe(true);
    expect(stages.toolExecutor.run).not.toHaveBeenCalled();
  });
});

describe('AgentPipeline — reasoning-stage clarification', () => {
  it('short-circuits before planning when ReasoningEngine requests clarification', async () => {
    const stages = createHappyPathStages();
    stages.reasoningEngine.run = vi.fn().mockResolvedValue({
      summary: 'Amount is ambiguous',
      needsClarification: true,
      clarificationQuestion: 'How much did Mary pay?',
    });
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());

    const response = await pipeline.run(ctx());

    expect(response.clarificationRequested).toBe(true);
    expect(response.message).toBe('How much did Mary pay?');
    expect(stages.planner.run).not.toHaveBeenCalled();
    expect(stages.toolExecutor.run).not.toHaveBeenCalled();
  });
});

describe('AgentPipeline — retry behavior', () => {
  it('retries a stage once on ProviderTimeoutError, and succeeds if the retry works', async () => {
    const stages = createHappyPathStages();
    let calls = 0;
    stages.entityExtractor.run = vi.fn().mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new ProviderTimeoutError('openai', 15000);
      return { customer: 'Mary', supplier: null, amount: 30000, currency: 'NGN', paymentMethod: null, product: null, quantity: null, expenseCategory: null, reminder: null, task: null, appointment: null, date: null, time: null, location: null, businessNote: null };
    });
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());

    const response = await pipeline.run(ctx());

    expect(calls).toBe(2);
    expect(response.success).toBe(true);
    expect(response.message).toBe('Payment recorded.');
  });

  it('gives up after exhausting the single retry and returns a generic failure', async () => {
    const stages = createHappyPathStages();
    stages.entityExtractor.run = vi.fn().mockRejectedValue(new ProviderTimeoutError('openai', 15000));
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());

    const response = await pipeline.run(ctx());

    expect(stages.entityExtractor.run).toHaveBeenCalledTimes(2); // original + 1 retry
    expect(response.success).toBe(false);
    expect(response.clarificationRequested).toBeUndefined();
  });

  it('does not retry MalformedOutputError more than once even across multiple stages', async () => {
    const stages = createHappyPathStages();
    stages.reasoningEngine.run = vi.fn().mockRejectedValue(new MalformedOutputError('{bad json'));
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());

    const response = await pipeline.run(ctx());

    expect(stages.reasoningEngine.run).toHaveBeenCalledTimes(2);
    expect(response.success).toBe(false);
  });

  it('respects retryPolicy.maxStageRetries = 0 (no retry at all)', async () => {
    const stages = createHappyPathStages();
    stages.entityExtractor.run = vi.fn().mockRejectedValue(new ProviderTimeoutError('openai', 15000));
    const config = buildAgentConfig({ retryPolicy: { maxStageRetries: 0, backoffMs: 0 } });
    const pipeline = new AgentPipeline(stages, config, createSilentLogger());

    await pipeline.run(ctx());

    expect(stages.entityExtractor.run).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry non-recoverable errors like ToolExecutionError', async () => {
    const stages = createHappyPathStages();
    stages.toolExecutor.run = vi.fn().mockRejectedValue(new ToolExecutionError('PaymentTool'));
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());

    const response = await pipeline.run(ctx());

    expect(stages.toolExecutor.run).toHaveBeenCalledTimes(1);
    expect(response.success).toBe(false);
  });
});

describe('AgentPipeline — unexpected errors', () => {
  it('catches a plain (non-AgentError) thrown error and responds gracefully', async () => {
    const stages = createHappyPathStages();
    stages.contextRetriever.run = vi.fn().mockRejectedValue(new Error('supabase connection reset'));
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());

    const response = await pipeline.run(ctx());

    expect(response.success).toBe(false);
    expect(response.message).toContain('went wrong');
  });
});

describe('AgentPipeline — explicit error-class recovery mapping', () => {
  it('LowConfidenceError with a missingField produces a targeted clarification question', async () => {
    const stages = createHappyPathStages();
    stages.entityExtractor.run = vi
      .fn()
      .mockRejectedValue(new LowConfidenceError(IntentName.RecordPayment, 0.4, 'amount'));
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());

    const response = await pipeline.run(ctx());

    expect(response.message).toMatch(/amount/i);
    expect(response.clarificationRequested).toBe(true);
  });

  it('UnknownIntentError thrown mid-pipeline still produces a clarification response', async () => {
    const stages = createHappyPathStages();
    stages.planner.run = vi.fn().mockRejectedValue(new UnknownIntentError('weird input'));
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());

    const response = await pipeline.run(ctx());

    expect(response.clarificationRequested).toBe(true);
  });
});
