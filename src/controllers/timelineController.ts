import { Request, Response } from 'express';
import { prisma } from '@integrations/prisma/client';
import { ApiResponse } from '@utils/apiResponse';
import { asyncHandler } from '@utils/asyncHandler';
import { AppError } from '@errors/AppError';
import { buildTimelineFeed } from '@services/businessInsightsService';

export const timelineController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const [customers, orders, payments, expenses, reminders, tasks] = await Promise.all([
      prisma.customer.findMany({ where: { businessId: req.user.businessId }, select: { id: true, name: true, createdAt: true } }),
      prisma.order.findMany({ where: { businessId: req.user.businessId }, select: { id: true, customerName: true, totalAmount: true, createdAt: true } }),
      prisma.payment.findMany({ where: { businessId: req.user.businessId }, select: { id: true, customerName: true, amount: true, createdAt: true } }),
      prisma.expense.findMany({ where: { businessId: req.user.businessId }, select: { id: true, title: true, amount: true, createdAt: true } }),
      prisma.reminder.findMany({ where: { businessId: req.user.businessId }, select: { id: true, message: true, createdAt: true } }),
      prisma.task.findMany({ where: { businessId: req.user.businessId }, select: { id: true, title: true, dueDate: true, createdAt: true } }),
    ]);

    const feed = buildTimelineFeed([
      ...customers.map((customer) => ({
        type: 'customer_created',
        title: `Customer created: ${customer.name}`,
        createdAt: customer.createdAt.toISOString(),
        metadata: { customerId: customer.id, name: customer.name },
      })),
      ...orders.map((order) => ({
        type: 'order',
        title: `Order for ${order.customerName}`,
        createdAt: order.createdAt.toISOString(),
        metadata: { orderId: order.id, totalAmount: order.totalAmount },
      })),
      ...payments.map((payment) => ({
        type: 'payment',
        title: `Payment received from ${payment.customerName}`,
        createdAt: payment.createdAt.toISOString(),
        metadata: { paymentId: payment.id, amount: payment.amount },
      })),
      ...expenses.map((expense) => ({
        type: 'expense',
        title: `Expense logged: ${expense.title}`,
        createdAt: expense.createdAt.toISOString(),
        metadata: { expenseId: expense.id, amount: expense.amount },
      })),
      ...reminders.map((reminder) => ({
        type: 'reminder',
        title: reminder.message,
        createdAt: reminder.createdAt.toISOString(),
        metadata: { reminderId: reminder.id },
      })),
      ...tasks.map((task) => ({
        type: 'task',
        title: task.title,
        createdAt: task.createdAt.toISOString(),
        metadata: { taskId: task.id, dueDate: task.dueDate },
      })),
    ]);

    ApiResponse.success(res, {
      message: 'Timeline retrieved successfully.',
      data: feed,
    });
  }),
};
