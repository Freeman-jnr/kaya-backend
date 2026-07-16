import { Request, Response } from 'express';
import { AppError } from '@errors/AppError';
import { prisma } from '@integrations/prisma/client';
import { ApiResponse } from '@utils/apiResponse';
import { asyncHandler } from '@utils/asyncHandler';

export const customerController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const customers = await prisma.customer.findMany({
      where: { businessId: req.user.businessId },
      orderBy: { createdAt: 'desc' },
    });

    ApiResponse.success(res, {
      message: 'Customers retrieved successfully.',
      data: customers,
    });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });

    if (!customer) {
      throw new AppError('Customer not found.', 404);
    }

    ApiResponse.success(res, {
      message: 'Customer retrieved successfully.',
      data: customer,
    });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const { name, email, phone, address, totalSpent, outstanding, status, lastInteraction } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      totalSpent?: number;
      outstanding?: number;
      status?: string;
      lastInteraction?: string;
    };

    if (!name) {
      throw new AppError('Customer name is required.', 400);
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        email: email ?? null,
        phone: phone ?? null,
        address: address ?? null,
        totalSpent: totalSpent ?? 0,
        outstanding: outstanding ?? 0,
        status: status ?? 'active',
        lastInteraction: lastInteraction ?? new Date().toISOString(),
        businessId: req.user.businessId,
      },
    });

    ApiResponse.success(res, {
      statusCode: 201,
      message: 'Customer created successfully.',
      data: customer,
    });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });

    if (!customer) {
      throw new AppError('Customer not found.', 404);
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: req.body,
    });

    ApiResponse.success(res, {
      message: 'Customer updated successfully.',
      data: updatedCustomer,
    });
  }),
};
