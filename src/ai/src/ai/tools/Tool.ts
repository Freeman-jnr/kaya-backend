/**
 * @file The generic Tool contract. Every concrete tool (PaymentTool,
 * ExpenseTool, ReminderTool, ...) implements ITool. Planner selects tools
 * by name via ToolRegistry (Module 11); ToolExecutor (Module 12) is the
 * only thing that calls execute()/rollback() directly.
 */

import { RetrievedContext } from '../retrieval/RetrievedContext';
import { ExtractedEntities } from '../extraction/Entities';
import { BusinessId, UserId } from '../types/common';

/** Result of validate() — mirrors the ServiceResult shape used elsewhere. */
export interface ValidationResult {
  valid: boolean;
  /** Human-readable reasons for failure, e.g. "amount is required". Empty when valid. */
  errors: string[];
}

/**
 * Machine-readable description of a tool, primarily used to tell the
 * Planner/ReasoningEngine what this tool does and what input shape it
 * expects — analogous to an OpenAI/Claude function-calling schema, but
 * provider-agnostic since Kaya builds its own planning layer.
 */
export interface ToolDescription {
  name: string;
  summary: string;
  /** JSON-schema-like description of expected input, kept intentionally loose (not full JSON Schema) for readability in prompts. */
  inputShape: Record<string, string>;
  /** Which IntentName values this tool is typically selected for. Informational only — Planner is not required to only use these. */
  associatedIntents: string[];
}

/** Everything a tool needs to do its job beyond its own typed input. */
export interface ToolExecutionContext {
  businessId: BusinessId;
  userId: UserId;
  requestId: string;
  entities: ExtractedEntities;
  retrievedContext: RetrievedContext;
}

/** Outcome of a single tool execution, captured by ToolExecutor for logging and for feeding ResponseGenerator. */
export interface ToolResult<TOutput = unknown> {
  toolName: string;
  success: boolean;
  output?: TOutput;
  error?: { code: string; message: string };
  /** An id ToolExecutor can pass back to rollback() if a later step in the same plan fails. */
  executionId?: string;
  durationMs: number;
}

/**
 * Generic tool interface. `TInput` is the tool's own validated input type
 * (typically derived from ExtractedEntities via a Zod schema inside the tool).
 */
export interface ITool<TInput = unknown, TOutput = unknown> {
  readonly name: string;

  describe(): ToolDescription;

  /** Validates raw input (usually built from ExtractedEntities) before execute() is called. */
  validate(input: unknown): ValidationResult;

  /** Performs the business operation via application services. Never touches the DB directly. */
  execute(input: TInput, context: ToolExecutionContext): Promise<ToolResult<TOutput>>;

  /** Reverses a prior execute() call, identified by the executionId it returned. Best-effort. */
  rollback(executionId: string): Promise<void>;
}
