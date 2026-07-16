import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTimelineFeed, searchRecords, buildDashboardSummary } from '../src/services/businessInsightsService';

test('builds a timeline feed from mixed records', () => {
    const feed = buildTimelineFeed([
      { type: 'customer_created', title: 'Customer created', createdAt: '2026-07-14T10:00:00.000Z', metadata: { name: 'Mary' } },
      { type: 'order', title: 'Order added', createdAt: '2026-07-14T11:00:00.000Z', metadata: { totalAmount: 120 } },
      { type: 'payment', title: 'Payment received', createdAt: '2026-07-14T12:00:00.000Z', metadata: { amount: 80 } },
    ] as any);

    assert.equal(feed.length, 3);
    assert.equal(feed[0].type, 'payment');
    assert.equal(feed[2].type, 'customer_created');
});

test('searches records by natural language keywords', () => {
    const results = searchRecords('who owes me', [
      { type: 'customer', name: 'Mary', outstanding: 75 },
      { type: 'order', customerName: 'Ada', totalAmount: 120 },
    ] as any);

    assert.equal(results.length, 1);
    assert.equal(results[0].type, 'customer');
});

test('builds dashboard summary cards', () => {
    const summary = buildDashboardSummary({
      revenueToday: 500,
      expensesToday: 120,
      outstandingBalances: 300,
      pendingOrders: 4,
      tasksDue: 2,
      recentActivity: 5,
    });

    assert.equal(summary.revenueToday, 500);
    assert.equal(summary.pendingOrders, 4);
});
