/**
 * @file Logging contract. Concrete implementation (Module 17: Telemetry)
 * wraps Pino, but every other module depends only on ILogger so tests can
 * inject a no-op/spy logger.
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured fields attached to a log line. Deliberately a loose record
 * rather than a rigid type — callers attach whatever's relevant (intent,
 * confidence, toolName, durationMs, etc). The concrete Logger implementation
 * is responsible for redacting anything matching known secret key patterns
 * before it reaches Pino, per "Do not log secrets."
 */
export type LogFields = Record<string, unknown>;

export interface ILogger {
  trace(fields: LogFields, message: string): void;
  debug(fields: LogFields, message: string): void;
  info(fields: LogFields, message: string): void;
  warn(fields: LogFields, message: string): void;
  error(fields: LogFields, message: string): void;
  /** Returns a new logger with these fields bound to every subsequent call — used to attach requestId/businessId once per request. */
  child(fields: LogFields): ILogger;
}
