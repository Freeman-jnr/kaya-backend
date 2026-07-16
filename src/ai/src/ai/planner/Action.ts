/**
 * @file An Action is one declarative step a Plan can contain. Planner
 * (Module 9) produces Plans; ToolExecutor (Module 12) walks them.
 */

/** Declarative reference to a tool invocation, with unresolved/templated input. */
export interface Action {
  /** Must match an ITool.name registered in ToolRegistry. */
  toolName: string;
  /**
   * Input for the tool. May reference outputs of earlier steps using
   * "$stepId.fieldName" placeholders, resolved by ToolExecutor at runtime
   * (e.g. a CustomerTool step's output.customerId feeding a PaymentTool step).
   */
  input: Record<string, unknown>;
  /** What to do if this action's tool execution fails. */
  onFailure?: 'abort' | 'continue' | 'rollback_previous';
}
