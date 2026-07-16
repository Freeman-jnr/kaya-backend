import { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async controller/route function so that any rejected promise
 * (thrown error, failed await, etc.) is forwarded to next(), which routes
 * it into our centralized errorHandler instead of crashing the process
 * or leaving the request hanging.
 *
 * Usage:
 *   router.get('/customers', asyncHandler(customerController.list));
 *
 * Every controller in every future module should be wrapped with this
 * rather than hand-writing try/catch — that duplication is exactly what
 * this utility exists to remove.
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
