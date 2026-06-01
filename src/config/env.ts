import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().optional(),
  ACCESS_TOKEN_SECRET: z.string().min(32).optional(),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRES_IN: z.string().optional(),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  PASSWORD_RESET_TOKEN_MINUTES: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default(''),
  COOKIE_DOMAIN: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional()
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const message = parsedEnv.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${message}`);
}

const accessTokenSecret = parsedEnv.data.ACCESS_TOKEN_SECRET ?? parsedEnv.data.JWT_SECRET;
const accessTokenExpiresIn = parsedEnv.data.ACCESS_TOKEN_EXPIRES_IN ?? parsedEnv.data.JWT_EXPIRES_IN ?? '15m';

if (!accessTokenSecret) {
  throw new Error('Invalid environment configuration: JWT_SECRET or ACCESS_TOKEN_SECRET is required');
}

export const env = {
  ...parsedEnv.data,
  ACCESS_TOKEN_SECRET: accessTokenSecret,
  ACCESS_TOKEN_EXPIRES_IN: accessTokenExpiresIn,
  CORS_ORIGINS: parsedEnv.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: parsedEnv.data.NODE_ENV === 'production'
};
