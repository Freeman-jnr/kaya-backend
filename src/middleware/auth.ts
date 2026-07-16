import { NextFunction, Request, Response } from 'express';
import { AppError } from '@errors/AppError';
import { asyncHandler } from '@utils/asyncHandler';
import { supabaseAdmin } from '@integrations/supabase/client';
import { prisma } from '@integrations/prisma/client';
import type { AuthenticatedUser } from '../types/auth';

export function requireAuth() {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Authentication token is required.', 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      throw new AppError('Invalid or expired authentication token.', 401);
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: data.user.id },
      include: { business: true },
    });

    if (!userRecord) {
      throw new AppError('Authenticated user was not found.', 401);
    }

    const authUser: AuthenticatedUser = {
      id: userRecord.id,
      email: userRecord.email,
      fullName: userRecord.fullName,
      role: userRecord.role as AuthenticatedUser['role'],
      businessId: userRecord.businessId ?? null,
    };

    req.user = authUser;
    next();
  });
}

export function requireRole(roles: Array<AuthenticatedUser['role']>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError('You do not have permission to perform this action.', 403);
    }
    next();
  };
}
