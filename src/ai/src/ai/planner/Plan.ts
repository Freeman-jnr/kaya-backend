/**
 * @file The Plan produced by Planner. Supports multi-step execution with
 * explicit dependencies, per spec ("The planner should support multi-step
 * execution").
 */

import { Action } from './Action';

/** A single step in a plan, wrapping an Action with an id and its dependencies. */
export interface PlanStep {
  /** Unique within the plan; referenced by other steps' input placeholders and by `dependsOn`. */
  id: string;
  action: Action;
  /** Step ids that must succeed before this step runs. Empty = runs immediately (in parallel with other roots, if the executor chooses to parallelize). */
  dependsOn: string[];
}

/** A complete, ordered plan of tool invocations to satisfy one user request. */
export interface Plan {
  /** The user-facing intent this plan was built to satisfy, for logging/tracing. */
  intent: string;
  steps: PlanStep[];
  /**
   * Human-readable rationale from the planning step (LLM- or rule-derived),
   * kept for telemetry/debugging — never shown to the end user verbatim.
   */
  rationale?: string;
}

/** An empty plan, useful as a safe default for e.g. `general_chat` intent where no tool execution is needed. */
export const EMPTY_PLAN: Plan = {
  intent: 'unknown',
  steps: [],
};
