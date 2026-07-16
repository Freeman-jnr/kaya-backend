import { describe, it, expect } from 'vitest';
import { IntentName, isActionableIntent } from '../classifier/Intent';

describe('IntentName', () => {
  it('contains every intent required by spec', () => {
    const required = [
      'record_payment',
      'record_expense',
      'create_customer',
      'update_customer',
      'create_order',
      'update_order',
      'create_task',
      'create_reminder',
      'create_note',
      'search_records',
      'dashboard_summary',
      'business_analysis',
      'general_chat',
      'unknown',
    ];
    const actual = Object.values(IntentName);
    for (const r of required) {
      expect(actual).toContain(r);
    }
  });

  it('isActionableIntent excludes Unknown and GeneralChat only', () => {
    expect(isActionableIntent(IntentName.Unknown)).toBe(false);
    expect(isActionableIntent(IntentName.GeneralChat)).toBe(false);
    expect(isActionableIntent(IntentName.RecordPayment)).toBe(true);
    expect(isActionableIntent(IntentName.DashboardSummary)).toBe(true);
  });
});
