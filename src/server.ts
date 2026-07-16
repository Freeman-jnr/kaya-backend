import { createApp } from './app';
import { env } from '@config/env';
import { logger } from '@config/logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Kaya backend running on port ${env.PORT} [${env.NODE_ENV}]`);
});

// Graceful shutdown — important on Railway/Render where deploys send SIGTERM.
function shutdown(signal: string): void {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });

  // Force exit if it hangs.
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});
