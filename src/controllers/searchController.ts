import { Request, Response } from 'express';
import { prisma } from '@integrations/prisma/client';
import { ApiResponse } from '@utils/apiResponse';
import { asyncHandler } from '@utils/asyncHandler';
import { AppError } from '@errors/AppError';
import { searchRecords } from '@services/businessInsightsService';

export const searchController = {
  search: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const query = (req.query.q as string | undefined)?.trim() ?? '';
    if (!query) {
      throw new AppError('A search query is required.', 400);
    }

    const [customers, orders, payments, expenses] = await Promise.all([
      prisma.customer.findMany({ where: { businessId: req.user.businessId }, select: { id: true, name: true, outstanding: true } }),
      prisma.order.findMany({ where: { businessId: req.user.businessId }, select: { id: true, customerName: true, totalAmount: true } }),
      prisma.payment.findMany({ where: { businessId: req.user.businessId }, select: { id: true, customerName: true, amount: true } }),
      prisma.expense.findMany({ where: { businessId: req.user.businessId }, select: { id: true, title: true, amount: true } }),
    ]);

    const results = searchRecords(query, [
      ...customers.map((customer) => ({ type: 'customer', title: customer.name, name: customer.name, outstanding: customer.outstanding })),
      ...orders.map((order) => ({ type: 'order', title: `Order for ${order.customerName}`, customerName: order.customerName, totalAmount: order.totalAmount })),
      ...payments.map((payment) => ({ type: 'payment', title: `Payment from ${payment.customerName}`, customerName: payment.customerName, amount: payment.amount })),
      ...expenses.map((expense) => ({ type: 'expense', title: expense.title, amount: expense.amount })),
    ]);

    ApiResponse.success(res, {
      message: 'Search completed successfully.',
      data: results,
    });
  }),
};
