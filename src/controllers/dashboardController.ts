import { Request, Response } from 'express';
import { prisma } from '@integrations/prisma/client';
import { ApiResponse } from '@utils/apiResponse';
import { asyncHandler } from '@utils/asyncHandler';
import { AppError } from '@errors/AppError';
import { buildDashboardSummary } from '@services/businessInsightsService';

export const dashboardController = {
  getSummary: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const [revenueToday, expensesToday, outstandingBalances, pendingOrders, tasksDue, recentActivity, counts] = await Promise.all([
      prisma.payment.aggregate({ where: { businessId: req.user.businessId, createdAt: { gte: startOfDay, lt: endOfDay } }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { businessId: req.user.businessId, createdAt: { gte: startOfDay, lt: endOfDay } }, _sum: { amount: true } }),
      prisma.customer.aggregate({ where: { businessId: req.user.businessId }, _sum: { outstanding: true } }),
      prisma.order.count({ where: { businessId: req.user.businessId, status: 'Pending' } }),
      prisma.task.count({ where: { businessId: req.user.businessId, dueDate: { not: null } } }),
      prisma.customer.count({ where: { businessId: req.user.businessId } }),
      prisma.$transaction([
        prisma.customer.count({ where: { businessId: req.user.businessId } }),
        prisma.order.count({ where: { businessId: req.user.businessId } }),
        prisma.payment.count({ where: { businessId: req.user.businessId } }),
        prisma.expense.count({ where: { businessId: req.user.businessId } }),
        prisma.task.count({ where: { businessId: req.user.businessId } }),
        prisma.reminder.count({ where: { businessId: req.user.businessId } }),
      ]),
    ]);

    const [customerCount, orderCount, paymentCount, expenseCount, taskCount, reminderCount] = counts;
    const activityCount = customerCount + orderCount + paymentCount + expenseCount + taskCount + reminderCount;

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const weeklyPayments = await prisma.payment.findMany({
      where: { businessId: req.user.businessId, createdAt: { gte: sevenDaysAgo } },
      select: { amount: true, createdAt: true },
    });

    const revenueByDay = Array.from({ length: 7 }).map((_, index) => {
      const dayDate = new Date(sevenDaysAgo);
      dayDate.setDate(sevenDaysAgo.getDate() + index);
      const dayStart = new Date(dayDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayDate);
      dayEnd.setHours(23, 59, 59, 999);

      const revenue = weeklyPayments
        .filter((payment) => {
          const created = new Date(payment.createdAt);
          return created >= dayStart && created <= dayEnd;
        })
        .reduce((sum, payment) => sum + payment.amount, 0);

      return {
        day: dayDate.toLocaleDateString('en-US', { weekday: 'short' }),
        date: dayDate.toISOString().slice(0, 10),
        revenue: Math.round(revenue * 100) / 100,
      };
    });

    ApiResponse.success(res, {
      message: 'Dashboard summary retrieved successfully.',
      data: buildDashboardSummary({
        revenueToday: revenueToday._sum.amount ?? 0,
        expensesToday: expensesToday._sum.amount ?? 0,
        outstandingBalances: outstandingBalances._sum.outstanding ?? 0,
        pendingOrders: pendingOrders,
        tasksDue: tasksDue,
        recentActivity: recentActivity,
        activityCount,
        revenueByDay,
      }),
    });
  }),
};
