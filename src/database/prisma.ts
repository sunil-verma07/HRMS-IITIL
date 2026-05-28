import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' }
  ]
});

prisma.$on('error', (event) => {
  logger.error({ target: event.target }, event.message);
});

prisma.$on('warn', (event) => {
  logger.warn({ target: event.target }, event.message);
});

export type TransactionClient = Prisma.TransactionClient;
