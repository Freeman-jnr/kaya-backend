import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../core/Agent';
import { AgentContext } from '../core/AgentContext';
import { AgentPipeline } from '../core/AgentPipeline';
import { DEFAULT_AGENT_CONFIG } from '../core/AgentConfig';
import { createHappyPathStages, createSilentLogger } from './testHelpers';

describe('AgentContext', () => {
  it('generates a requestId when none is supplied', () => {
    const context = AgentContext.create({ rawMessage: 'hi', businessId: 'b1', userId: 'u1' });
    expect(context.requestId).toBeTruthy();
    expect(typeof context.requestId).toBe('string');
  });

  it('uses a supplied requestId instead of generating one', () => {
    const context = AgentContext.create({
      rawMessage: 'hi',
      businessId: 'b1',
      userId: 'u1',
      requestId: 'req-fixed-123',
    });
    expect(context.requestId).toBe('req-fixed-123');
  });

  it('starts with an empty trace and no downstream fields populated', () => {
    const context = AgentContext.create({ rawMessage: 'hi', businessId: 'b1', userId: 'u1' });
    expect(context.trace).toEqual([]);
    expect(context.intent).toBeUndefined();
    expect(context.response).toBeUndefined();
  });

  it('recordTrace appends events with a default startedAt when not supplied', () => {
    const context = AgentContext.create({ rawMessage: 'hi', businessId: 'b1', userId: 'u1' });
    context.recordTrace({ stage: 'test_stage', durationMs: 42, outcome: 'success' });
    expect(context.trace).toHaveLength(1);
    expect(context.trace[0]?.stage).toBe('test_stage');
    expect(context.trace[0]?.startedAt).toBeTruthy();
  });
});

describe('Agent', () => {
  it('creates a context and delegates to the pipeline, returning its response', async () => {
    const stages = createHappyPathStages();
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());
    const agent = new Agent(pipeline, createSilentLogger());

    const response = await agent.handle({
      rawMessage: 'Mary paid 30000',
      businessId: 'biz_1',
      userId: 'user_1',
    });

    expect(response.success).toBe(true);
    expect(response.message).toBe('Payment recorded.');
  });

  it('never throws even when a stage fails unexpectedly', async () => {
    const stages = createHappyPathStages();
    stages.intentClassifier.run = vi.fn().mockRejectedValue(new Error('boom'));
    const pipeline = new AgentPipeline(stages, DEFAULT_AGENT_CONFIG, createSilentLogger());
    const agent = new Agent(pipeline, createSilentLogger());

    await expect(
      agent.handle({ rawMessage: 'x', businessId: 'b1', userId: 'u1' }),
    ).resolves.toMatchObject({ success: false });
  });
});
