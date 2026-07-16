import { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Reads `page` and `limit` from query params and normalizes them into
 * safe values. Bad input (negative numbers, non-numeric strings,
 * limit > MAX_LIMIT) falls back to sane defaults rather than erroring —
 * pagination params are a convenience, not something worth 400-ing a
 * request over.
 */
export function getPaginationParams(req: Request): PaginationParams {
  const rawPage = Number(req.query.page);
  const rawLimit = Number(req.query.limit);

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Builds the `meta` block returned alongside paginated list responses.
 * Repositories return totalItems from a COUNT query; this turns that
 * into the page-math every list endpoint needs.
 */
export function buildPaginationMeta(
  page: number,
  limit: number,
  totalItems: number
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / limit) || 0;

  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
