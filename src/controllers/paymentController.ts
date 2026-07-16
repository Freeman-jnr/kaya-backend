import { Request, Response } from 'express';
import { AppError } from '@errors/AppError';
import { prisma } from '@integrations/prisma/client';
import { ApiResponse } from '@utils/apiResponse';
import { asyncHandler } from '@utils/asyncHandler';

export const paymentController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const payments = await prisma.payment.findMany({
      where: { businessId: req.user.businessId },
      orderBy: { createdAt: 'desc' },
    });

    ApiResponse.success(res, {
      message: 'Payments retrieved successfully.',
      data: payments,
    });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const { customerName, amount, method, notes } = req.body as {
      customerName?: string;
      amount?: number;
      method?: string;
      notes?: string;
    };

    if (!customerName || typeof amount !== 'number' || amount <= 0) {
      throw new AppError('Customer name and a positive amount are required.', 400);
    }

    const payment = await prisma.payment.create({
      data: {
        customerName,
        amount,
        method: method ?? 'Cash',
        notes: notes ?? null,
        businessId: req.user.businessId,
      },
    });

    // Keep the customer's outstanding balance coherent with recorded payments.
    const customer = await prisma.customer.findFirst({
      where: { businessId: req.user.businessId, name: customerName },
    });

    if (customer) {
      const outstanding = Math.max(0, Math.round((customer.outstanding - amount) * 100) / 100);
      await prisma.customer.update({
        where: { id: customer.id },
        data: { outstanding, lastInteraction: new Date().toISOString() },
      });
    }

    ApiResponse.success(res, {
      statusCode: 201,
      message: 'Payment recorded successfully.',
      data: payment,
    });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const existing = await prisma.payment.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });

    if (!existing) {
      throw new AppError('Payment not found.', 404);
    }

    const updated = await prisma.payment.update({
      where: { id: existing.id },
      data: req.body,
    });

    ApiResponse.success(res, {
      message: 'Payment updated successfully.',
      data: updated,
    });
  }),
};
