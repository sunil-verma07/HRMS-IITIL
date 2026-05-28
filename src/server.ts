import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './database/prisma';

async function bootstrap(): Promise<void> {
  await prisma.$connect();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'IITIL Portal API started');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down API');
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch(async (error) => {
  logger.error({ error }, 'Failed to start API');
  await prisma.$disconnect();
  process.exit(1);
});
