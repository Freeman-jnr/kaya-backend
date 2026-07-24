import { Request, Response } from 'express';
import { AppError } from '@errors/AppError';
import { prisma } from '@integrations/prisma/client';
import { ApiResponse } from '@utils/apiResponse';
import { asyncHandler } from '@utils/asyncHandler';

const allowedOrderStatuses = ['Pending', 'In Progress', 'Completed', 'Delivered', 'Cancelled'];

export const orderController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 50);
    const skip = (page - 1) * limit;

    const [total, orders] = await Promise.all([
      prisma.order.count({ where: { businessId: req.user.businessId } }),
      prisma.order.findMany({
        where: { businessId: req.user.businessId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          customerName: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    ApiResponse.success(res, {
      message: 'Orders retrieved successfully.',
      data: orders,
      meta: { pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } },
    });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const { customerName, totalAmount, notes, status } = req.body as {
      customerName?: string;
      totalAmount?: number;
      notes?: string;
      status?: string;
    };

    if (!customerName || typeof totalAmount !== 'number' || totalAmount <= 0) {
      throw new AppError('Customer name and a positive total amount are required.', 400);
    }

    const normalizedStatus = status && allowedOrderStatuses.includes(status) ? status : 'Pending';

    const order = await prisma.order.create({
      data: {
        customerName,
        totalAmount,
        notes: notes ?? null,
        status: normalizedStatus,
        businessId: req.user.businessId,
      },
    });

    // Opening an order increases what the customer owes and refreshes activity.
    const customer = await prisma.customer.findFirst({
      where: { businessId: req.user.businessId, name: customerName },
    });

    if (customer) {
      const outstanding = Math.round((customer.outstanding + totalAmount) * 100) / 100;
      await prisma.customer.update({
        where: { id: customer.id },
        data: { outstanding, totalSpent: Math.round((customer.totalSpent + totalAmount) * 100) / 100, lastInteraction: new Date().toISOString() },
      });
    }

    ApiResponse.success(res, {
      statusCode: 201,
      message: 'Order created successfully.',
      data: order,
    });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const existing = await prisma.order.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });

    if (!existing) {
      throw new AppError('Order not found.', 404);
    }

    const { status } = req.body as { status?: string };
    if (status && !allowedOrderStatuses.includes(status)) {
      throw new AppError('Invalid order status.', 400);
    }

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: req.body,
    });

    ApiResponse.success(res, {
      message: 'Order updated successfully.',
      data: updated,
    });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const existing = await prisma.order.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });

    if (!existing) {
      throw new AppError('Order not found.', 404);
    }

    await prisma.order.delete({ where: { id: existing.id } });

    ApiResponse.success(res, {
      message: 'Order deleted successfully.',
      data: null,
    });
  }),
};
