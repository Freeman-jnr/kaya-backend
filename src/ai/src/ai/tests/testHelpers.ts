import { vi } from 'vitest';
import { ILogger, LogFields } from '../telemetry/Logger';
import { PipelineStages } from '../interfaces/IStages';
import { IntentName } from '../classifier/Intent';
import { EMPTY_ENTITIES } from '../extraction/Entities';

/** No-op logger for tests — captures nothing, just satisfies ILogger. */
export function createSilentLogger(): ILogger {
  const logger: ILogger = {
    trace: (_f: LogFields, _m: string) => {},
    debug: (_f: LogFields, _m: string) => {},
    info: (_f: LogFields, _m: string) => {},
    warn: (_f: LogFields, _m: string) => {},
    error: (_f: LogFields, _m: string) => {},
    child: () => logger,
  };
  return logger;
}

/**
 * Builds a full set of mock PipelineStages that succeed with minimal valid
 * output for a `record_payment` flow. Individual tests override specific
 * stages (e.g. `intentClassifier.run` to throw) via vi.fn() mocks.
 */
export function createHappyPathStages(): PipelineStages {
  return {
    intentClassifier: {
      stageName: 'intent_classification',
      run: vi.fn().mockResolvedValue({ intent: IntentName.RecordPayment, confidence: 0.95 }),
    },
    entityExtractor: {
      stageName: 'entity_extraction',
      run: vi.fn().mockResolvedValue({ ...EMPTY_ENTITIES, customer: 'Mary', amount: 30000, currency: 'NGN' }),
    },
    contextRetriever: {
      stageName: 'context_retrieval',
      run: vi.fn().mockResolvedValue({ businessId: 'biz_1', matchedCustomer: null }),
    },
    reasoningEngine: {
      stageName: 'reasoning',
      run: vi.fn().mockResolvedValue({ summary: 'Record a payment from Mary', needsClarification: false }),
    },
    planner: {
      stageName: 'planning',
      run: vi.fn().mockResolvedValue({ intent: IntentName.RecordPayment, steps: [] }),
    },
    toolExecutor: {
      stageName: 'tool_execution',
      run: vi.fn().mockResolvedValue([]),
    },
    responseGenerator: {
      stageName: 'response_generation',
      run: vi.fn().mockResolvedValue({
        message: 'Payment recorded.',
        intent: IntentName.RecordPayment,
        success: true,
      }),
    },
  };
}
