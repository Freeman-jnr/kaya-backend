import { Request, Response } from 'express';
import { AppError } from '@errors/AppError';
import { prisma } from '@integrations/prisma/client';
import { ApiResponse } from '@utils/apiResponse';
import { asyncHandler } from '@utils/asyncHandler';

export const taskController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 50);
    const skip = (page - 1) * limit;

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where: { businessId: req.user.businessId } }),
      prisma.task.findMany({
        where: { businessId: req.user.businessId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          dueDate: true,
          priority: true,
          completed: true,
          createdAt: true,
        },
      }),
    ]);

    ApiResponse.success(res, {
      message: 'Tasks retrieved successfully.',
      data: tasks,
      meta: { pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const { title, dueDate, priority, notes, source } = req.body as {
      title?: string;
      dueDate?: string;
      priority?: string;
      notes?: string;
      source?: string;
    };

    if (!title) {
      throw new AppError('Task title is required.', 400);
    }

    const task = await prisma.task.create({
      data: {
        title,
        dueDate: dueDate ?? null,
        priority: priority ?? 'medium',
        notes: notes ?? null,
        source: source ?? 'manual',
        businessId: req.user.businessId,
      },
    });

    ApiResponse.success(res, {
      statusCode: 201,
      message: 'Task created successfully.',
      data: task,
    });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });

    if (!existing) {
      throw new AppError('Task not found.', 404);
    }

    const updated = await prisma.task.update({
      where: { id: existing.id },
      data: req.body,
    });

    ApiResponse.success(res, {
      message: 'Task updated successfully.',
      data: updated,
    });
  }),
};
