import { Request, Response } from 'express';
import { AppError } from '@errors/AppError';
import { prisma } from '@integrations/prisma/client';
import { ApiResponse } from '@utils/apiResponse';
import { asyncHandler } from '@utils/asyncHandler';

export const expenseController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 50);
    const skip = (page - 1) * limit;

    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where: { businessId: req.user.businessId } }),
      prisma.expense.findMany({
        where: { businessId: req.user.businessId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          amount: true,
          category: true,
          createdAt: true,
        },
      }),
    ]);

    ApiResponse.success(res, {
      message: 'Expenses retrieved successfully.',
      data: expenses,
      meta: { pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const { title, amount, category, notes } = req.body as {
      title?: string;
      amount?: number;
      category?: string;
      notes?: string;
    };

    if (!title || typeof amount !== 'number' || amount <= 0) {
      throw new AppError('Expense title and a positive amount are required.', 400);
    }

    const expense = await prisma.expense.create({
      data: {
        title,
        amount,
        category: category ?? 'General',
        notes: notes ?? null,
        businessId: req.user.businessId,
      },
    });

    ApiResponse.success(res, {
      statusCode: 201,
      message: 'Expense recorded successfully.',
      data: expense,
    });
  }),
};
