/**
 * @file The shape of business context assembled by ContextRetriever (Module 8).
 * ContextRetriever never queries Postgres/Supabase directly — it calls the
 * application service interfaces declared here and assembles their results
 * into this single object for ReasoningEngine/Planner to consume.
 *
 * NOTE: The concrete service interfaces (ICustomerService, IPaymentService, ...)
 * are declared here as minimal read-oriented contracts. Per your confirmation,
 * these application services don't exist yet in your codebase — wire these
 * interfaces to your real implementations when they're built. Nothing in the
 * `ai/` layer imports a database client directly, which is what enforces the
 * "never query the database directly" rule architecturally.
 */

import { BusinessId, Money, ISODateTime, Paginated } from '../types/common';

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string | null;
  outstandingBalance: Money;
  lastActivityAt: ISODateTime | null;
}

export interface OrderRecord {
  id: string;
  customerId: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
  total: Money;
  createdAt: ISODateTime;
}

export interface PaymentRecord {
  id: string;
  customerId: string | null;
  amount: Money;
  method: string;
  recordedAt: ISODateTime;
}

export interface ExpenseRecord {
  id: string;
  category: string;
  amount: Money;
  recordedAt: ISODateTime;
}

export interface TaskRecord {
  id: string;
  title: string;
  dueAt: ISODateTime | null;
  completed: boolean;
}

export interface ReminderRecord {
  id: string;
  message: string;
  remindAt: ISODateTime;
}

export interface TimelineEvent {
  id: string;
  type: string;
  summary: string;
  occurredAt: ISODateTime;
}

export interface DashboardMetrics {
  revenueThisWeek: Money;
  revenueLastWeek: Money;
  outstandingReceivables: Money;
  expensesThisWeek: Money;
}

/**
 * Aggregated business context handed to ReasoningEngine + Planner.
 * ContextRetriever decides *which* of these to populate per-request based
 * on the classified intent (e.g. no need to fetch DashboardMetrics for a
 * `create_reminder` intent) — all fields are therefore optional.
 */
export interface RetrievedContext {
  businessId: BusinessId;
  matchedCustomer?: CustomerRecord | null;
  recentOrders?: OrderRecord[];
  recentPayments?: PaymentRecord[];
  recentExpenses?: ExpenseRecord[];
  openTasks?: TaskRecord[];
  upcomingReminders?: ReminderRecord[];
  recentTimeline?: TimelineEvent[];
  dashboard?: DashboardMetrics;
}

/** Minimal read-oriented service contracts ContextRetriever depends on. */
export interface ICustomerService {
  findByNameFuzzy(businessId: BusinessId, name: string): Promise<CustomerRecord | null>;
  getById(businessId: BusinessId, customerId: string): Promise<CustomerRecord | null>;
}

export interface IOrderService {
  listRecent(businessId: BusinessId, limit: number): Promise<OrderRecord[]>;
}

export interface IPaymentService {
  listRecent(businessId: BusinessId, limit: number): Promise<PaymentRecord[]>;
}

export interface IExpenseService {
  listRecent(businessId: BusinessId, limit: number): Promise<ExpenseRecord[]>;
}

export interface ITaskService {
  listOpen(businessId: BusinessId): Promise<TaskRecord[]>;
}

export interface IReminderService {
  listUpcoming(businessId: BusinessId): Promise<ReminderRecord[]>;
}

export interface ITimelineService {
  listRecent(businessId: BusinessId, limit: number): Promise<TimelineEvent[]>;
}

export interface IDashboardService {
  getMetrics(businessId: BusinessId): Promise<DashboardMetrics>;
}

export interface ISearchService {
  search(businessId: BusinessId, query: string): Promise<Paginated<TimelineEvent>>;
}
