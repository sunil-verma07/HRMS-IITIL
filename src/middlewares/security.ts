import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { HttpStatus } from '../common/http/status-codes';
import { env } from '../config/env';
import { logger } from '../config/logger';

export function registerSecurityMiddleware(app: Express): void {
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : true,
      credentials: true
    })
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      statusCode: HttpStatus.TOO_MANY_REQUESTS
    })
  );
  app.use(
    pinoHttp({
      logger,
      autoLogging: env.NODE_ENV !== 'test'
    })
  );
}
