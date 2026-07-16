/**
 * @file Concrete AgentContext. Implements IAgentContext (Module 2) and adds
 * the one behavior every stage invocation needs: recording a TraceEvent.
 * This is deliberately the *only* piece of pipeline behavior that lives on
 * the context itself — everything else (stage sequencing, error recovery)
 * belongs to AgentPipeline.
 */

import { randomUUID } from 'crypto';
import { AgentResponse, IAgentContext, ReasoningOutput, TraceEvent } from '../interfaces/IAgentContext';
import { BusinessId, RequestId, UserId } from '../types/common';
import { ClassifiedIntent } from '../classifier/Intent';
import { ExtractedEntities } from '../extraction/Entities';
import { RetrievedContext } from '../retrieval/RetrievedContext';
import { Plan } from '../planner/Plan';
import { ToolResult } from '../tools/Tool';

export interface CreateAgentContextInput {
  rawMessage: string;
  businessId: BusinessId;
  userId: UserId;
  /** Supply explicitly for testability/log correlation with an upstream request id; generated otherwise. */
  requestId?: RequestId;
}

export class AgentContext implements IAgentContext {
  readonly requestId: RequestId;
  readonly businessId: BusinessId;
  readonly userId: UserId;
  readonly rawMessage: string;
  readonly receivedAt: string;

  intent?: ClassifiedIntent;
  entities?: ExtractedEntities;
  businessContext?: RetrievedContext;
  reasoning?: ReasoningOutput;
  plan?: Plan;
  toolResults?: ToolResult[];
  response?: AgentResponse;

  trace: TraceEvent[] = [];

  private constructor(input: Required<CreateAgentContextInput>) {
    this.requestId = input.requestId;
    this.businessId = input.businessId;
    this.userId = input.userId;
    this.rawMessage = input.rawMessage;
    this.receivedAt = new Date().toISOString();
  }

  static create(input: CreateAgentContextInput): AgentContext {
    return new AgentContext({
      ...input,
      requestId: input.requestId ?? randomUUID(),
    });
  }

  /**
   * Records how one pipeline stage went. AgentPipeline calls this after
   * every stage attempt (success, error, or deliberately skipped) — this
   * is the backbone of the "log every reasoning step" requirement.
   */
  recordTrace(event: Omit<TraceEvent, 'startedAt'> & { startedAt?: string }): void {
    this.trace.push({
      startedAt: event.startedAt ?? new Date().toISOString(),
      stage: event.stage,
      durationMs: event.durationMs,
      outcome: event.outcome,
      detail: event.detail,
    });
  }}
