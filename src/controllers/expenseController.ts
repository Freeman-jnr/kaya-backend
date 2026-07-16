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

    const expenses = await prisma.expense.findMany({
      where: { businessId: req.user.businessId },
      orderBy: { createdAt: 'desc' },
    });

    ApiResponse.success(res, {
      message: 'Expenses retrieved successfully.',
      data: expenses,
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
