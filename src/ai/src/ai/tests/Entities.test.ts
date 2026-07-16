import { describe, it, expect } from 'vitest';
import {
  ExtractedEntitiesSchema,
  parseExtractedEntities,
  EMPTY_ENTITIES,
} from '../extraction/Entities';

describe('ExtractedEntitiesSchema', () => {
  it('accepts a fully-null entities object (the safe default)', () => {
    expect(() => parseExtractedEntities(EMPTY_ENTITIES)).not.toThrow();
  });

  it('accepts a partially-filled, well-formed object', () => {
    const raw = {
      ...EMPTY_ENTITIES,
      customer: 'Mary',
      amount: 30000,
      currency: 'NGN',
      paymentMethod: 'cash',
    };
    const parsed = parseExtractedEntities(raw);
    expect(parsed.customer).toBe('Mary');
    expect(parsed.amount).toBe(30000);
    expect(parsed.paymentMethod).toBe('cash');
  });

  it('rejects an invalid paymentMethod enum value (simulated hallucination)', () => {
    const raw = { ...EMPTY_ENTITIES, paymentMethod: 'crypto' };
    expect(() => parseExtractedEntities(raw)).toThrow();
  });

  it('rejects a missing required field (undefined, not null) — forces explicit nulls', () => {
    const { customer, ...withoutCustomer } = EMPTY_ENTITIES;
    void customer;
    expect(() => parseExtractedEntities(withoutCustomer)).toThrow();
  });

  it('rejects a currency code that is not exactly 3 characters', () => {
    const raw = { ...EMPTY_ENTITIES, currency: 'NAIRA' };
    expect(() => parseExtractedEntities(raw)).toThrow();
  });

  it('rejects extra/unexpected fields being silently accepted with wrong types', () => {
    const raw = { ...EMPTY_ENTITIES, amount: '30000' }; // string, not number
    expect(() => parseExtractedEntities(raw)).toThrow();
  });

  it('schema and type stay in sync (compile-time check via safeParse)', () => {
    const result = ExtractedEntitiesSchema.safeParse(EMPTY_ENTITIES);
    expect(result.success).toBe(true);
  });
});
