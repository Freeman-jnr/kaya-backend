import { Request, Response } from 'express';
import { prisma } from '@integrations/prisma/client';
import { ApiResponse } from '@utils/apiResponse';
import { asyncHandler } from '@utils/asyncHandler';
import { AppError } from '@errors/AppError';

export const notificationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const businessId = req.user.businessId;

    const [pendingOrders, outstandingCustomers, customersWithOutstanding, tasksDue, revenueToday] = await Promise.all([
      prisma.order.count({ where: { businessId, status: 'Pending' } }),
      prisma.customer.aggregate({ where: { businessId }, _sum: { outstanding: true } }),
      prisma.customer.count({ where: { businessId, outstanding: { gt: 0 } } }),
      prisma.task.count({ where: { businessId, completed: false } }),
      prisma.payment.aggregate({
        where: {
          businessId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const outstandingTotal = outstandingCustomers._sum.outstanding ?? 0;
    const notifications = [];

    if (pendingOrders > 0) {
      notifications.push({
        id: 'pending-orders',
        type: 'orders',
        title: 'Pending Orders',
        message: `You have ${pendingOrders} order${pendingOrders > 1 ? 's' : ''} waiting to be fulfilled.`,
        actionUrl: '/app/orders',
        createdAt: new Date().toISOString(),
      });
    }

    if (customersWithOutstanding > 0) {
      notifications.push({
        id: 'outstanding-payments',
        type: 'payments',
        title: 'Outstanding Payments',
        message: `${customersWithOutstanding} customer${customersWithOutstanding > 1 ? 's' : ''} owe you a total of ${outstandingTotal}.`,
        actionUrl: '/app/payments',
        createdAt: new Date().toISOString(),
      });
    }

    if (tasksDue > 0) {
      notifications.push({
        id: 'open-tasks',
        type: 'tasks',
        title: 'Open Tasks',
        message: `You have ${tasksDue} incomplete task${tasksDue > 1 ? 's' : ''} to review.`,
        actionUrl: '/app/tasks',
        createdAt: new Date().toISOString(),
      });
    }

    const rev = revenueToday._sum.amount ?? 0;
    if (rev > 0) {
      notifications.push({
        id: 'daily-revenue',
        type: 'summary',
        title: 'Daily Summary',
        message: `You've made ${rev} in revenue today. Great job!`,
        actionUrl: '/app/dashboard',
        createdAt: new Date().toISOString(),
      });
    }

    // Static notifications
    notifications.push({
      id: 'active-sub',
      type: 'info',
      title: 'Subscription Active',
      message: 'Your Kaya Free Plan is active.',
      createdAt: new Date().toISOString(),
    });

    notifications.push({
      id: 'login-alert',
      type: 'info',
      title: 'Security Alert',
      message: 'New login detected from your current IP.',
      createdAt: new Date().toISOString(),
    });

    ApiResponse.success(res, {
      message: 'Notifications retrieved successfully.',
      data: notifications,
    });
  }),
};
