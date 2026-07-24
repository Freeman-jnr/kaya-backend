import { Request, Response } from 'express';
import { AppError } from '@errors/AppError';
import { prisma } from '@integrations/prisma/client';
import { ApiResponse } from '@utils/apiResponse';
import { asyncHandler } from '@utils/asyncHandler';

export const reminderController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 50);
    const skip = (page - 1) * limit;

    const [total, reminders] = await Promise.all([
      prisma.reminder.count({ where: { businessId: req.user.businessId } }),
      prisma.reminder.findMany({
        where: { businessId: req.user.businessId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          message: true,
          remindAt: true,
          createdAt: true,
        },
      }),
    ]);

    ApiResponse.success(res, {
      message: 'Reminders retrieved successfully.',
      data: reminders,
      meta: { pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const { message, remindAt } = req.body as {
      message?: string;
      remindAt?: string;
    };

    if (!message) {
      throw new AppError('Reminder message is required.', 400);
    }

    const reminder = await prisma.reminder.create({
      data: {
        message,
        remindAt: remindAt ?? null,
        businessId: req.user.businessId,
      },
    });

    ApiResponse.success(res, {
      statusCode: 201,
      message: 'Reminder created successfully.',
      data: reminder,
    });
  }),
};
