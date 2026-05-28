import pino from 'pino';
import { env } from './env';

const loggerOptions: pino.LoggerOptions = {
  level: env.isProduction ? 'info' : 'debug',
  redact: ['req.headers.authorization', 'req.headers.cookie', 'password', 'passwordHash', 'refreshToken'],
  ...(!env.isProduction
    ? {
        transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard'
        }
      }
      }
    : {})
};

export const logger = pino(loggerOptions);
