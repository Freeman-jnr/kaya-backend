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

    const reminders = await prisma.reminder.findMany({
      where: { businessId: req.user.businessId },
      orderBy: { createdAt: 'desc' },
    });

    ApiResponse.success(res, {
      message: 'Reminders retrieved successfully.',
      data: reminders,
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
