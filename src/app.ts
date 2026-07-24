import express, { Application, Request, Response } from 'express';
import compression from 'compression';
import pinoHttp from 'pino-http';
import { logger } from '@config/logger';
import { corsMiddleware, helmetMiddleware, rateLimitMiddleware } from '@middleware/security';
import { errorHandler, notFoundHandler } from '@middleware/errorHandler';
import { requestLogger } from '@middleware/requestLogger';
import { ApiResponse } from '@utils/apiResponse';
import authRoutes from '@routes/authRoutes';
import businessRoutes from '@routes/businessRoutes';
import customerRoutes from '@routes/customerRoutes';
import orderRoutes from '@routes/orderRoutes';
import paymentRoutes from '@routes/paymentRoutes';
import expenseRoutes from '@routes/expenseRoutes';
import taskRoutes from '@routes/taskRoutes';
import reminderRoutes from '@routes/reminderRoutes';
import timelineRoutes from '@routes/timelineRoutes';
import searchRoutes from '@routes/searchRoutes';
import dashboardRoutes from '@routes/dashboardRoutes';
import notificationRoutes from '@routes/notificationRoutes';
import aiRoutes from '@routes/aiRoutes';

export function createApp(): Application {
  const app = express();

  // --- Security & parsing (order matters) ---
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(rateLimitMiddleware);
  app.use(requestLogger);
  app.use(pinoHttp({ logger }));

  // --- Health check (no auth, used by Railway/Render) ---
  app.get('/health', (_req: Request, res: Response) => {
    ApiResponse.success(res, {
      message: 'Kaya backend is healthy',
      data: { timestamp: new Date().toISOString() },
    });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/business', businessRoutes);
  app.use('/api/v1/customers', customerRoutes);
  app.use('/api/v1/orders', orderRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/expenses', expenseRoutes);
  app.use('/api/v1/tasks', taskRoutes);
  app.use('/api/v1/reminders', reminderRoutes);
  app.use('/api/v1/timeline', timelineRoutes);
  app.use('/api/v1/search', searchRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/ai', aiRoutes);

  // --- 404 + centralized error handling (must be last) ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
