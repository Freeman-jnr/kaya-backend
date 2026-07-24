import { Request, Response } from 'express';
import { AppError } from '@errors/AppError';
import { prisma } from '@integrations/prisma/client';
import { ApiResponse } from '@utils/apiResponse';
import { asyncHandler } from '@utils/asyncHandler';
import { supabaseAdmin } from '@integrations/supabase/client';

export const authController = {
  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { business: true },
    });

    ApiResponse.success(res, {
      message: 'Authenticated user profile fetched successfully.',
      data: user,
    });
  }),

  updateMe: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const { fullName, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { fullName, phone },
      include: { business: true },
    });

    ApiResponse.success(res, {
      message: 'User profile updated successfully.',
      data: user,
    });
  }),

  register: asyncHandler(async (req: Request, res: Response) => {
    const { email, password, fullName, phone, businessName, businessCategory, location } = req.body as {
      email?: string;
      password?: string;
      fullName?: string;
      phone?: string;
      businessName?: string;
      businessCategory?: string;
      location?: string;
    };

    if (!email || !password || !fullName) {
      throw new AppError('Email, password, and full name are required.', 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('A user with this email already exists.', 409);
    }

    const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fullName, phone },
    });

    const createdUserId = data?.user?.id;
    if (authError || !createdUserId) {
      throw new AppError('Unable to create authentication profile.', 500);
    }

    const business = await prisma.business.create({
      data: {
        name: businessName ?? `${fullName.split(' ')[0]}'s Business`,
        category: businessCategory ?? 'general',
        location: location ?? 'Unknown',
        ownerId: createdUserId,
      },
    });

    const user = await prisma.user.create({
      data: {
        id: createdUserId,
        email,
        fullName,
        phone: phone ?? null,
        role: 'owner',
        businessId: business.id,
      },
      include: { business: true },
    });

    ApiResponse.success(res, {
      statusCode: 201,
      message: 'Account created successfully.',
      data: user,
    });
  }),

  login: asyncHandler(async (_req: Request, res: Response) => {
    ApiResponse.success(res, {
      message: 'Use Supabase Auth on the frontend to sign in and send the access token in the Authorization header.',
      data: { note: 'Frontend handles Supabase login; backend validates JWTs.' },
    });
  }),
};
