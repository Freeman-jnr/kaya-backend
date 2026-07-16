/**
 * @file The interface every pipeline stage class implements
 * (IntentClassifier, EntityExtractor, ContextRetriever, ReasoningEngine,
 * Planner, ToolExecutor, ResponseGenerator). AgentPipeline (Module 3)
 * depends only on this — stages are fully swappable/mockable.
 */

import { IAgentContext } from './IAgentContext';

/**
 * `TOut` is the piece of data this stage is responsible for producing and
 * attaching to context (e.g. IntentClassifier's TOut is ClassifiedIntent).
 * `run` receives the full context (stages often need earlier stages'
 * output) but returns only its own slice — AgentPipeline is responsible
 * for attaching the result to context between stages, which keeps each
 * stage implementation trivial to unit test in isolation.
 */
export interface IPipelineStage<TOut> {
  readonly stageName: string;
  run(context: Readonly<IAgentContext>): Promise<TOut>;
}
