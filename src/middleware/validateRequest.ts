import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiResponse } from '@utils/apiResponse';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Generic request validator. Takes any Zod schema and a request part to
 * validate against it, then either:
 *   - replaces req[part] with the parsed (and type-coerced) data, or
 *   - short-circuits with a 400 + field-level error list.
 *
 * This is deliberately generic rather than per-module — every future
 * module (Customers, Orders, Payments, ...) defines its own schemas in
 * src/validators/, and mounts them on routes with this same middleware:
 *
 *   router.post('/customers', validateRequest(createCustomerSchema, 'body'), asyncHandler(...))
 *
 * Keeping this here means schema *content* lives with its owning
 * module, but the *mechanism* that enforces it is written once.
 */
export function validateRequest(schema: AnyZodObject, part: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      const zodError = result.error as ZodError;
      const fieldErrors = zodError.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      ApiResponse.error(res, {
        statusCode: 400,
        message: 'Validation failed',
        errors: fieldErrors,
      });
      return;
    }

    // Reassign so downstream code gets Zod's parsed/coerced values,
    // not the raw untyped request data.
    req[part] = result.data;
    next();
  };
}
