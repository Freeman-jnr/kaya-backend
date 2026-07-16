import { Request, Response, NextFunction } from 'express';
import { logger } from '@config/logger';

export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  logger.info({ method: req.method, path: req.originalUrl }, 'request received');
  next();
}
