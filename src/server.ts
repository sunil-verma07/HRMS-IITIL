import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './database/prisma';
import type { Server } from 'http';
import { startInterviewNotificationWorker, stopInterviewNotificationWorker } from './workers/interview-notifications.worker';

const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN'];

function validateStartupEnvironment(): void {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    for (const key of missing) {
      logger.error({ key }, 'Missing required environment variable');
    }

    process.exit(1);
  }
}

async function gracefulShutdown(signal: string, server: Server): Promise<void> {
  logger.info({ signal }, 'Shutting down API');
  stopInterviewNotificationWorker();

  const forcedExit = setTimeout(() => process.exit(1), 10_000);

  server.close(async () => {
    clearTimeout(forcedExit);
    await prisma.$disconnect();
    process.exit(0);
  });
}

async function bootstrap(): Promise<void> {
  validateStartupEnvironment();
  await prisma.$connect();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'IITIL Portal API started');
    startInterviewNotificationWorker();
  });

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM', server));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT', server));
}

bootstrap().catch(async (error) => {
  logger.error({ error }, 'Failed to start API');
  await prisma.$disconnect();
  process.exit(1);
});