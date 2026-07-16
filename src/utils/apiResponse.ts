import { Response } from 'express';

interface SuccessOptions<T> {
  statusCode?: number;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

interface ErrorOptions {
  statusCode?: number;
  message: string;
  errors?: unknown[];
}

/**
 * Single source of truth for the response envelope shape defined in the
 * spec:
 *   success: { success: true, message, data }
 *   error:   { success: false, message, errors }
 *
 * Every controller, from every future module, should respond through
 * these two functions rather than building the object inline — that's
 * what keeps the shape consistent across 15+ endpoints instead of
 * "close enough" per-route.
 */
export const ApiResponse = {
  success<T>(res: Response, { statusCode = 200, message, data, meta }: SuccessOptions<T>): void {
    res.status(statusCode).json({
      success: true,
      message,
      data: data ?? null,
      ...(meta ? { meta } : {}),
    });
  },

  error(res: Response, { statusCode = 500, message, errors = [] }: ErrorOptions): void {
    res.status(statusCode).json({
      success: false,
      message,
      errors,
    });
  },
};
