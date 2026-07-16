/**
 * @file The shape of AgentContext, the object threaded through every
 * pipeline stage. Declared here (interfaces/) as a pure shape; the
 * concrete builder/class lives in core/AgentContext.ts (Module 3).
 */

import { BusinessId, RequestId, UserId, ISODateTime } from '../types/common';
import { ClassifiedIntent } from '../classifier/Intent';
import { ExtractedEntities } from '../extraction/Entities';
import { RetrievedContext } from '../retrieval/RetrievedContext';
import { Plan } from '../planner/Plan';
import { ToolResult } from '../tools/Tool';

/** A single stage's contribution to the trace, appended in AgentPipeline. */
export interface TraceEvent {
  stage: string;
  startedAt: ISODateTime;
  durationMs: number;
  outcome: 'success' | 'error' | 'skipped';
  detail?: Record<string, unknown>;
}

export interface ReasoningOutput {
  /** Free-form reasoning summary from ReasoningEngine, used to build the Plan and, if needed, the clarification question. */
  summary: string;
  needsClarification: boolean;
  clarificationQuestion?: string;
}

export interface AgentResponse {
  message: string;
  intent: string;
  success: boolean;
  /** Present when the agent needs one more piece of information rather than having failed outright. */
  clarificationRequested?: boolean;
}

/**
 * The object every pipeline stage reads from and writes to. Stages must
 * only ever *add* fields relevant to their own concern — never mutate
 * fields owned by an earlier stage.
 */
export interface IAgentContext {
  readonly requestId: RequestId;
  readonly businessId: BusinessId;
  readonly userId: UserId;
  readonly rawMessage: string;
  readonly receivedAt: ISODateTime;

  intent?: ClassifiedIntent;
  entities?: ExtractedEntities;
  businessContext?: RetrievedContext;
  reasoning?: ReasoningOutput;
  plan?: Plan;
  toolResults?: ToolResult[];
  response?: AgentResponse;

  trace: TraceEvent[];
}
