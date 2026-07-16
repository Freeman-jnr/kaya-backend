/**
 * Base application error. Kept intentionally minimal for Module 1 —
 * Module 18 (Error Handling) will build out the full hierarchy
 * (ValidationError, NotFoundError, UnauthorizedError, etc).
 *
 * `isOperational` distinguishes errors we expect and handle gracefully
 * (bad input, not found, etc.) from programmer errors/bugs, which
 * should NOT be caught and swallowed the same way.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
