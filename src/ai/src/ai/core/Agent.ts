/**
 * @file The only class outside src/ai that anything should import.
 * Express integration (Module 18) calls agent.handle(...) and nothing else.
 */

import { AgentContext, CreateAgentContextInput } from './AgentContext';
import { AgentPipeline } from './AgentPipeline';
import { AgentResponse } from '../interfaces/IAgentContext';
import { ILogger } from '../telemetry/Logger';

export class Agent {
  constructor(
    private readonly pipeline: AgentPipeline,
    private readonly logger: ILogger,
  ) {}

  /**
   * Processes one user message end-to-end through the full pipeline and
   * returns the final response. Never throws — all failure modes are
   * translated into a user-facing AgentResponse by AgentPipeline.
   */
  async handle(input: CreateAgentContextInput): Promise<AgentResponse> {
    const context = AgentContext.create(input);
    this.logger.info(
      { requestId: context.requestId, businessId: context.businessId },
      'Agent received message',
    );
    return this.pipeline.run(context);
  }
}
