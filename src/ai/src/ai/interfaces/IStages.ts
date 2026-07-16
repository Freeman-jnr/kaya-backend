/**
 * @file Typed contracts for each of the 7 pipeline stages. AgentPipeline
 * (this module) depends only on these interfaces via constructor injection.
 * Concrete implementations arrive in later modules:
 *   IIntentClassifierStage  -> classifier/IntentClassifier.ts   (Module 6)
 *   IEntityExtractorStage   -> extraction/EntityExtractor.ts    (Module 7)
 *   IContextRetrieverStage  -> retrieval/ContextRetriever.ts    (Module 8)
 *   IReasoningEngineStage   -> reasoning/ReasoningEngine.ts     (Module 11, reordered before Planner per pipeline diagram)
 *   IPlannerStage           -> planner/Planner.ts               (Module 9)
 *   IToolExecutorStage      -> tools/ToolExecutor.ts            (Module 12)
 *   IResponseGeneratorStage -> responses/ResponseGenerator.ts   (Module 13)
 *
 * Each extends IPipelineStage<TOut> with the concrete output type that
 * stage contributes to IAgentContext.
 */

import { IPipelineStage } from './IPipelineStage';
import { ClassifiedIntent } from '../classifier/Intent';
import { ExtractedEntities } from '../extraction/Entities';
import { RetrievedContext } from '../retrieval/RetrievedContext';
import { Plan } from '../planner/Plan';
import { ToolResult } from '../tools/Tool';
import { ReasoningOutput, AgentResponse } from './IAgentContext';

export type IIntentClassifierStage = IPipelineStage<ClassifiedIntent>;
export type IEntityExtractorStage = IPipelineStage<ExtractedEntities>;
export type IContextRetrieverStage = IPipelineStage<RetrievedContext>;
export type IReasoningEngineStage = IPipelineStage<ReasoningOutput>;
export type IPlannerStage = IPipelineStage<Plan>;
export type IToolExecutorStage = IPipelineStage<ToolResult[]>;
export type IResponseGeneratorStage = IPipelineStage<AgentResponse>;

/** Bundle of all stages, the single dependency AgentPipeline's constructor takes. */
export interface PipelineStages {
  intentClassifier: IIntentClassifierStage;
  entityExtractor: IEntityExtractorStage;
  contextRetriever: IContextRetrieverStage;
  reasoningEngine: IReasoningEngineStage;
  planner: IPlannerStage;
  toolExecutor: IToolExecutorStage;
  responseGenerator: IResponseGeneratorStage;
}
