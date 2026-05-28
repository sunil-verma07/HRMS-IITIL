import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

type JwtExpiresIn = NonNullable<jwt.SignOptions['expiresIn']>;

export type AccessTokenPayload = {
  sub: string;
  userId: string;
  sessionId: string;
  permissions: string[];
};

export type RefreshTokenPayload = {
  sub: string;
  sessionId: string;
  familyId: string;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as JwtExpiresIn,
    issuer: 'iitil-portal',
    audience: 'iitil-portal-users'
  };

  return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, options);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as JwtExpiresIn,
    issuer: 'iitil-portal',
    audience: 'iitil-portal-users'
  };

  return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.ACCESS_TOKEN_SECRET, {
    issuer: 'iitil-portal',
    audience: 'iitil-portal-users'
  }) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET, {
    issuer: 'iitil-portal',
    audience: 'iitil-portal-users'
  }) as RefreshTokenPayload;
}
