/**
 * @file Defines every business intent Kaya can recognize, plus the shape
 * of a classification result. This is the contract IntentClassifier (Module 6)
 * must fulfill and Planner (Module 9) consumes.
 */

/**
 * All recognized user intents. Add new values here when extending Kaya
 * (e.g. `record_inventory_movement` for the Inventory module) — nothing
 * else in this file needs to change.
 */
export enum IntentName {
  RecordPayment = 'record_payment',
  RecordExpense = 'record_expense',
  CreateCustomer = 'create_customer',
  UpdateCustomer = 'update_customer',
  CreateOrder = 'create_order',
  UpdateOrder = 'update_order',
  CreateTask = 'create_task',
  CreateReminder = 'create_reminder',
  CreateNote = 'create_note',
  SearchRecords = 'search_records',
  DashboardSummary = 'dashboard_summary',
  BusinessAnalysis = 'business_analysis',
  GeneralChat = 'general_chat',
  Unknown = 'unknown',
}

/**
 * Confidence is expressed as a float in [0, 1]. Consumers (AgentPipeline)
 * apply a configurable threshold (see AgentConfig) below which the intent
 * is treated as low-confidence and routed to clarification.
 */
export type ConfidenceScore = number;

/** The result produced by IntentClassifier for a single user message. */
export interface ClassifiedIntent {
  intent: IntentName;
  confidence: ConfidenceScore;
  /**
   * Optional second-choice intent, useful when ReasoningEngine wants to
   * offer a disambiguation question rather than a generic "I didn't understand".
   */
  alternativeIntent?: IntentName;
  /** Raw rationale from the underlying classification step, for logging/debugging only. */
  rationale?: string;
}

/** Type guard: is this intent one Kaya can act on (i.e. not Unknown/GeneralChat)? */
export function isActionableIntent(intent: IntentName): boolean {
  return intent !== IntentName.Unknown && intent !== IntentName.GeneralChat;
}
