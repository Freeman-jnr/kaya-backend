/**
 * @file AgentPipeline runs the exact stage sequence from spec:
 *   Intent Classification -> Entity Extraction -> Context Retrieval ->
 *   Reasoning -> Planning -> Tool Selection/Execution -> Response Generation
 *
 * Two responsibilities live here and nowhere else:
 *  1. Sequencing stages and attaching each stage's output to AgentContext.
 *  2. Centralized error recovery, mapping AgentError subclasses to the
 *     exact behaviors from spec (clarify / retry / fallback / repair).
 *     Note: provider-level fallback *between providers* is ProviderRouter's
 *     job (Module 11) — what AgentPipeline retries here is the *stage
 *     invocation itself*, giving a stage a second chance after its own
 *     internal recovery (e.g. ProviderRouter switching providers) has run.
 */

import { AgentContext } from './AgentContext';
import { AgentConfig } from './AgentConfig';
import {
  isAgentError,
  LowConfidenceError,
  ToolValidationError,
  UnknownIntentError,
} from './AgentError';
import { PipelineStages } from '../interfaces/IStages';
import { AgentResponse, TraceEvent } from '../interfaces/IAgentContext';
import { isActionableIntent } from '../classifier/Intent';
import { ILogger } from '../telemetry/Logger';

/** Error codes AgentPipeline will retry the *stage call* for, once, before giving up. */
const STAGE_RETRYABLE_CODES = new Set([
  'PROVIDER_TIMEOUT',
  'PROVIDER_UNAVAILABLE',
  'MALFORMED_OUTPUT',
]);

export class AgentPipeline {
  constructor(
    private readonly stages: PipelineStages,
    private readonly config: AgentConfig,
    private readonly logger: ILogger,
  ) {}

  async run(context: AgentContext): Promise<AgentResponse> {
    const log = this.logger.child({ requestId: context.requestId, businessId: context.businessId });

    try {
      context.intent = await this.runStage('intent_classification', context, (ctx) =>
        this.stages.intentClassifier.run(ctx),
      );

      if (!isActionableIntent(context.intent.intent)) {
        throw new UnknownIntentError(context.rawMessage);
      }
      if (context.intent.confidence < this.config.confidenceThreshold) {
        throw new LowConfidenceError(context.intent.intent, context.intent.confidence);
      }

      context.entities = await this.runStage('entity_extraction', context, (ctx) =>
        this.stages.entityExtractor.run(ctx),
      );

      context.businessContext = await this.runStage('context_retrieval', context, (ctx) =>
        this.stages.contextRetriever.run(ctx),
      );

      context.reasoning = await this.runStage('reasoning', context, (ctx) =>
        this.stages.reasoningEngine.run(ctx),
      );

      if (context.reasoning.needsClarification) {
        const response = this.buildClarificationResponse(
          context.intent.intent,
          context.reasoning.clarificationQuestion ?? 'Could you clarify that a bit further?',
        );
        context.response = response;
        this.finish(context, log);
        return response;
      }

      context.plan = await this.runStage('planning', context, (ctx) => this.stages.planner.run(ctx));

      context.toolResults = await this.runStage('tool_execution', context, (ctx) =>
        this.stages.toolExecutor.run(ctx),
      );

      context.response = await this.runStage('response_generation', context, (ctx) =>
        this.stages.responseGenerator.run(ctx),
      );

      this.finish(context, log);
      return context.response;
    } catch (err) {
      const response = this.recover(err, context, log);
      context.response = response;
      this.finish(context, log);
      return response;
    }
  }

  /**
   * Wraps a single stage invocation with timing, tracing, and the
   * single-retry policy for provider-class errors.
   */
  private async runStage<T>(
    stageName: string,
    context: AgentContext,
    invoke: (ctx: AgentContext) => Promise<T>,
  ): Promise<T> {
    const startedAt = new Date().toISOString();
    const start = Date.now();
    try {
      const result = await invoke(context);
      context.recordTrace({
        stage: stageName,
        startedAt,
        durationMs: Date.now() - start,
        outcome: 'success',
      });
      return result;
    } catch (err) {
      const code = isAgentError(err) ? err.code : 'UNEXPECTED_ERROR';
      const shouldRetry =
        isAgentError(err) && err.recoverable && STAGE_RETRYABLE_CODES.has(err.code) &&
        this.config.retryPolicy.maxStageRetries > 0;

      context.recordTrace({
        stage: stageName,
        startedAt,
        durationMs: Date.now() - start,
        outcome: 'error',
        detail: { code, willRetry: shouldRetry, message: (err as Error).message },
      });

      if (!shouldRetry) throw err;

      await this.sleep(this.config.retryPolicy.backoffMs);

      const retryStart = Date.now();
      const retryStartedAt = new Date().toISOString();
      try {
        const result = await invoke(context);
        context.recordTrace({
          stage: `${stageName}_retry`,
          startedAt: retryStartedAt,
          durationMs: Date.now() - retryStart,
          outcome: 'success',
        });
        return result;
      } catch (retryErr) {
        context.recordTrace({
          stage: `${stageName}_retry`,
          startedAt: retryStartedAt,
          durationMs: Date.now() - retryStart,
          outcome: 'error',
          detail: { message: (retryErr as Error).message },
        });
        throw retryErr;
      }
    }
  }

  /** Maps a thrown error to a final AgentResponse. Never throws. */
  private recover(err: unknown, context: AgentContext, log: ILogger): AgentResponse {
    const intentLabel = context.intent?.intent ?? 'unknown';

    if (isAgentError(err)) {
      log.warn({ code: err.code, requestId: context.requestId }, `Recovering from ${err.code}`);

      switch (err.code) {
        case 'UNKNOWN_INTENT':
          return this.buildClarificationResponse(
            intentLabel,
            "I'm not sure what you'd like me to do. Could you rephrase that?",
          );

        case 'LOW_CONFIDENCE': {
          const e = err as LowConfidenceError;
          return this.buildClarificationResponse(
            intentLabel,
            e.missingField
              ? `Could you confirm the ${e.missingField}?`
              : "I want to make sure I get this right — could you give me a bit more detail?",
          );
        }

        case 'TOOL_VALIDATION_FAILED': {
          const e = err as ToolValidationError;
          return this.buildClarificationResponse(
            intentLabel,
            `I need a bit more information: ${e.errors.join(', ')}.`,
          );
        }

        case 'PROVIDER_TIMEOUT':
        case 'PROVIDER_UNAVAILABLE':
          return {
            message: "I'm having trouble processing that right now. Please try again in a moment.",
            intent: intentLabel,
            success: false,
          };

        case 'MALFORMED_OUTPUT':
          return {
            message: "Something went wrong while processing that. Could you try rephrasing?",
            intent: intentLabel,
            success: false,
          };

        default:
          return {
            message: "I couldn't complete that action. Please try again.",
            intent: intentLabel,
            success: false,
          };
      }
    }

    // Truly unexpected (non-AgentError) failure — log with full detail, respond generically.
    log.error(
      { requestId: context.requestId, error: err instanceof Error ? err.message : String(err) },
      'Unexpected pipeline failure',
    );
    return {
      message: "Something went wrong on my end. Please try again shortly.",
      intent: intentLabel,
      success: false,
    };
  }

  private buildClarificationResponse(intent: string, question: string): AgentResponse {
    return {
      message: question,
      intent,
      success: false,
      clarificationRequested: true,
    };
  }

  private finish(context: AgentContext, log: ILogger): void {
    const totalDurationMs = context.trace.reduce((sum: number, t: TraceEvent) => sum + t.durationMs, 0);
    log.info(
      {
        intent: context.intent?.intent,
        confidence: context.intent?.confidence,
        success: context.response?.success,
        stages: context.trace.length,
        totalDurationMs,
      },
      'Agent pipeline completed',
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
