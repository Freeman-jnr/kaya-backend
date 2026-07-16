import { Request, Response } from 'express';
import { AppError } from '@errors/AppError';
import { prisma } from '@integrations/prisma/client';
import { ApiResponse } from '@utils/apiResponse';
import { asyncHandler } from '@utils/asyncHandler';

export const businessController = {
  getCurrent: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const business = await prisma.business.findUnique({
      where: { id: req.user.businessId },
      include: { users: true, customers: true },
    });

    if (!business) {
      throw new AppError('Business not found.', 404);
    }

    const owner = business.users.find((user) => user.id === business.ownerId);

    ApiResponse.success(res, {
      message: 'Business profile retrieved successfully.',
      data: {
        ...business,
        ownerName: owner?.fullName ?? null,
        memberCount: business.users.length,
        customerCount: business.customers.length,
      },
    });
  }),

  updateCurrent: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.businessId) {
      throw new AppError('No business is linked to this account.', 404);
    }

    const business = await prisma.business.update({
      where: { id: req.user.businessId },
      data: req.body,
    });

    ApiResponse.success(res, {
      message: 'Business profile updated successfully.',
      data: business,
    });
  }),
};
