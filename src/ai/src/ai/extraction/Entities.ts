/**
 * @file Defines the entity extraction schema using Zod. This schema is the
 * single source of truth for what EntityExtractor (Module 7) is allowed to
 * return — runtime-validated, so a malformed/hallucinated LLM response is
 * caught immediately rather than silently propagating through the pipeline.
 *
 * Rule from spec: "Unknown fields must be null. Never hallucinate." —
 * every field below is therefore `.nullable()` rather than `.optional()`.
 * Optional would let the model omit a field silently; nullable forces it
 * to explicitly state "I don't know this" as `null`, which we can validate
 * against and log.
 */

import { z } from 'zod';

export const PaymentMethodSchema = z.enum([
  'cash',
  'bank_transfer',
  'card',
  'mobile_money',
  'pos',
  'unknown',
]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const ExtractedEntitiesSchema = z.object({
  customer: z.string().nullable(),
  supplier: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().length(3).nullable(),
  paymentMethod: PaymentMethodSchema.nullable(),
  product: z.string().nullable(),
  quantity: z.number().nullable(),
  expenseCategory: z.string().nullable(),
  reminder: z.string().nullable(),
  task: z.string().nullable(),
  appointment: z.string().nullable(),
  date: z.string().nullable(),
  time: z.string().nullable(),
  location: z.string().nullable(),
  businessNote: z.string().nullable(),
});

/**
 * Fully-typed extracted entities, all fields explicitly nullable to force
 * every caller to handle the "not present" case rather than assume presence.
 */
export type ExtractedEntities = z.infer<typeof ExtractedEntitiesSchema>;

/** A ready-to-use "all null" entities object, useful as a safe default/fallback. */
export const EMPTY_ENTITIES: ExtractedEntities = {
  customer: null,
  supplier: null,
  amount: null,
  currency: null,
  paymentMethod: null,
  product: null,
  quantity: null,
  expenseCategory: null,
  reminder: null,
  task: null,
  appointment: null,
  date: null,
  time: null,
  location: null,
  businessNote: null,
};

/**
 * Validates a raw (untrusted, likely LLM-produced) object against the schema.
 * Throws a ZodError on failure — callers in EntityExtractor are expected to
 * catch this and raise a MalformedOutputError (see AgentError.ts) so the
 * pipeline's repair/retry logic can kick in.
 */
export function parseExtractedEntities(raw: unknown): ExtractedEntities {
  return ExtractedEntitiesSchema.parse(raw);
}
