import express from 'express';
import { env } from './config/env';
import { errorHandler } from './middlewares/error-handler';
import { notFoundHandler } from './middlewares/not-found';
import { registerSecurityMiddleware } from './middlewares/security';
import { v1Routes } from './routes/v1.routes';

export function createApp() {
  const app = express();

  registerSecurityMiddleware(app);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(env.API_PREFIX, v1Routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
