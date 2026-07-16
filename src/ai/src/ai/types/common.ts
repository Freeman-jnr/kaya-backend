/**
 * @file Common primitive types used across the Kaya AI framework.
 * These have no dependency on any other module in src/ai.
 */

/** ISO-8601 date-time string, e.g. "2026-07-15T10:30:00.000Z" */
export type ISODateTime = string;

/** ISO-8601 date-only string, e.g. "2026-07-15" */
export type ISODate = string;

/** Supported currencies for Kaya's target markets. Extend as new markets are added. */
export type CurrencyCode = 'NGN' | 'GHS' | 'KES' | 'ZAR' | 'USD';

/**
 * Monetary amount represented as minor units (kobo/cents) to avoid floating point
 * arithmetic errors. Always pair with a CurrencyCode.
 */
export interface Money {
  /** Amount in minor units, e.g. ₦30,000.00 -> 3000000 kobo */
  minorUnits: number;
  currency: CurrencyCode;
}

/** Identifies a tenant business within Kaya. Every operation is scoped to one. */
export type BusinessId = string;

/** Identifies the end user (owner/staff) interacting with Kaya. */
export type UserId = string;

/** Unique id for a single agent invocation, used to correlate logs/traces. */
export type RequestId = string;

/**
 * Generic paginated result wrapper returned by business services.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * A lightweight discriminated union for operations that can fail in an
 * expected (non-exceptional) way at the service boundary. Pipeline *stages*
 * do not use this — they throw AgentError subclasses — but application
 * services returning data to the ContextRetriever/Tools may use it.
 */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
