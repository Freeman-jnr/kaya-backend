export interface TimelineItem {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface SearchRecord {
  type: string;
  title?: string;
  name?: string;
  customerName?: string;
  amount?: number;
  outstanding?: number;
  totalAmount?: number;
  [key: string]: unknown;
}

export interface RevenuePoint {
  day: string;
  date: string;
  revenue: number;
}

export interface DashboardSummary {
  revenueToday: number;
  expensesToday: number;
  outstandingBalances: number;
  pendingOrders: number;
  tasksDue: number;
  recentActivity: number;
  activityCount: number;
  revenueByDay: RevenuePoint[];
}

export function buildTimelineFeed(items: Array<Partial<TimelineItem> & { createdAt?: string }>): TimelineItem[] {
  return items
    .filter(Boolean)
    .map((item, index) => ({
      id: item.id ?? `timeline-${index}`,
      type: item.type ?? 'activity',
      title: item.title ?? 'Activity',
      createdAt: item.createdAt ?? new Date().toISOString(),
      metadata: item.metadata ?? {},
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function searchRecords(query: string, records: SearchRecord[]): SearchRecord[] {
  const normalized = query.toLowerCase();

  return records.filter((record) => {
    const haystack = [
      record.type,
      record.title,
      record.name,
      record.customerName,
      record.amount?.toString(),
      record.outstanding?.toString(),
      record.totalAmount?.toString(),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const wantsOwes = normalized.includes('owe') || normalized.includes('owing') || normalized.includes('outstanding');
    if (wantsOwes) {
      return (record.outstanding ?? 0) > 0;
    }

    if (normalized.includes('payment')) {
      return haystack.includes('payment');
    }

    if (normalized.includes('expense')) {
      return haystack.includes('expense');
    }

    if (normalized.includes('sales') || normalized.includes('order')) {
      return haystack.includes('order') || haystack.includes('sale');
    }

    return haystack.includes(normalized) || haystack.includes(normalized.split(' ')[0] ?? '');
  });
}

export function buildDashboardSummary(values: DashboardSummary): DashboardSummary {
  return {
    revenueToday: values.revenueToday,
    expensesToday: values.expensesToday,
    outstandingBalances: values.outstandingBalances,
    pendingOrders: values.pendingOrders,
    tasksDue: values.tasksDue,
    recentActivity: values.recentActivity,
    activityCount: values.activityCount,
    revenueByDay: values.revenueByDay,
  };
}
