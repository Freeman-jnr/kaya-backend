import { NextFunction, Request, Response } from 'express';
import { AppError } from '@errors/AppError';
import { logger } from '@config/logger';
import { env } from '@config/env';
import { ApiResponse } from '@utils/apiResponse';

/**
 * Last-resort error handler. Every route/service should throw AppError
 * (or a subclass, once Module 18 adds them) rather than letting raw
 * errors bubble up — this handler decides what's safe to expose.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // Express only treats a handler as error-handling middleware if it has
  // exactly 4 params — `next` must stay even though it's unused here.
  _next: NextFunction
): void {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;

  logger.error(
    {
      err,
      path: req.path,
      method: req.method,
      statusCode,
    },
    'Request error'
  );

  ApiResponse.error(res, {
    statusCode,
    message: isAppError ? err.message : 'Something went wrong. Please try again.',
    errors: env.NODE_ENV === 'development' && !isAppError && err.stack ? [err.stack] : [],
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  ApiResponse.error(res, {
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}
