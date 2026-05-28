import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import {
  ForbiddenError,
  UnauthorizedError
} from '../../common/errors/app-error';
import { createOpaqueToken, sha256 } from '../../common/utils/crypto';
import { addDuration } from '../../common/utils/duration';
import { hashPassword, verifyPassword } from '../../common/utils/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from '../../common/utils/tokens';
import { env } from '../../config/env';
import { prisma } from '../../database/prisma';
import { AuthRepository, type UserWithAccess } from './auth.repository';
import type {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto
} from './auth.validation';
import type { AuthResult, AuthTokens, RequestMeta } from './auth.types';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export class AuthService {
  constructor(private readonly repository = new AuthRepository()) {}

  async login(input: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.repository.findUserByUserId(input.userId);

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    this.assertLoginAllowed(user);

    const isValidPassword = await verifyPassword(input.password, user.passwordHash);

    if (!isValidPassword) {
      await this.recordFailedLogin(user, meta);
      throw new UnauthorizedError('Invalid credentials');
    }

    await this.repository.resetLoginFailures(user.id, user.forcePasswordReset ? 'PASSWORD_RESET_REQUIRED' : 'ACTIVE');
    await this.repository.createAuditLog({
      actorUserId: user.id,
      event: 'auth.login.success',
      ...(meta.ipAddress ? { ipAddress: meta.ipAddress } : {}),
      ...(meta.userAgent ? { userAgent: meta.userAgent } : {})
    });

    return this.issueTokens(user, meta);
  }

  async refresh(input: RefreshTokenDto, meta: RequestMeta): Promise<AuthResult> {
    const payload = this.verifyRefreshTokenOrThrow(input.refreshToken);
    const tokenHash = sha256(input.refreshToken);
    const session = await this.repository.findSessionById(payload.sessionId);

    if (!session || session.familyId !== payload.familyId) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (session.refreshTokenHash !== tokenHash) {
      await this.repository.revokeSessionFamily(session.familyId);
      throw new UnauthorizedError('Refresh token reuse detected');
    }

    if (session.revokedAt || session.expiresAt <= new Date() || session.user.deletedAt) {
      throw new UnauthorizedError('Refresh session expired');
    }

    const nextSessionId = randomUUID();
    const nextRefreshToken = signRefreshToken({
      sub: session.userId,
      sessionId: nextSessionId,
      familyId: session.familyId
    });

    await prisma.$transaction(async (tx) => {
      await this.repository.createSession(
        this.buildSessionCreateInput({
          sessionId: nextSessionId,
          userId: session.userId,
          familyId: session.familyId,
          refreshToken: nextRefreshToken,
          meta
        }),
        tx
      );
      await this.repository.revokeSession(session.id, tx, nextSessionId);
    });

    return {
      ...this.buildAccessResult(session.user, nextSessionId),
      refreshToken: nextRefreshToken
    };
  }

  async logout(refreshToken: string | undefined, sessionId: string | undefined): Promise<void> {
    if (refreshToken) {
      const payload = this.verifyRefreshTokenOrThrow(refreshToken);
      await this.repository.revokeSession(payload.sessionId);
      return;
    }

    if (!sessionId) {
      throw new UnauthorizedError();
    }

    await this.repository.revokeSession(sessionId);
  }

  async forgotPassword(input: ForgotPasswordDto): Promise<{ resetToken?: string }> {
    const user = await this.repository.findUserByUserId(input.userId);

    if (!user) {
      return {};
    }

    const resetToken = createOpaqueToken();
    await this.repository.createPasswordResetToken(
      user.id,
      sha256(resetToken),
      addDuration(new Date(), `${env.PASSWORD_RESET_TOKEN_MINUTES}m`)
    );

    return env.isProduction ? {} : { resetToken };
  }

  async resetPassword(input: ResetPasswordDto): Promise<void> {
    const resetToken = await this.repository.findActivePasswordResetToken(sha256(input.token));

    if (!resetToken) {
      throw new UnauthorizedError('Invalid or expired password reset token');
    }

    await prisma.$transaction(async (tx) => {
      await this.repository.updatePassword(resetToken.userId, await hashPassword(input.newPassword), tx);
      await this.repository.markPasswordResetTokenUsed(resetToken.id, tx);
      await this.repository.revokeUserSessions(resetToken.userId, tx);
    });
  }

  async changePassword(userId: string, sessionId: string, input: ChangePasswordDto): Promise<void> {
    const user = await this.repository.findUserById(userId);

    if (!user) {
      throw new UnauthorizedError();
    }

    const isValidPassword = await verifyPassword(input.currentPassword, user.passwordHash);

    if (!isValidPassword) {
      throw new ForbiddenError('Current password is incorrect');
    }

    await prisma.$transaction(async (tx) => {
      await this.repository.updatePassword(user.id, await hashPassword(input.newPassword), tx);
      await this.repository.revokeUserSessions(user.id, tx, sessionId);
    });
  }

  private assertLoginAllowed(user: UserWithAccess): void {
    if (user.status === 'INACTIVE' || user.deletedAt) {
      throw new UnauthorizedError('Account is inactive');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedError('Account is temporarily locked');
    }

    if (user.status === 'LOCKED' && !user.lockedUntil) {
      throw new UnauthorizedError('Account is locked');
    }
  }

  private async recordFailedLogin(user: UserWithAccess, meta: RequestMeta): Promise<void> {
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : null;

    await this.repository.updateLoginFailure(user.id, failedLoginAttempts, lockedUntil);
    await this.repository.createAuditLog({
      actorUserId: user.id,
      event: lockedUntil ? 'auth.login.locked' : 'auth.login.failed',
      ...(meta.ipAddress ? { ipAddress: meta.ipAddress } : {}),
      ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
      metadata: { failedLoginAttempts }
    });
  }

  private async issueTokens(user: UserWithAccess, meta: RequestMeta): Promise<AuthResult> {
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const refreshToken = signRefreshToken({
      sub: user.id,
      sessionId,
      familyId
    });

    await this.repository.createSession(
      this.buildSessionCreateInput({
        sessionId,
        userId: user.id,
        familyId,
        refreshToken,
        meta
      })
    );

    return {
      ...this.buildAccessResult(user, sessionId),
      refreshToken
    };
  }

  private buildAccessResult(user: UserWithAccess, sessionId: string): Omit<AuthResult, keyof Pick<AuthTokens, 'refreshToken'>> {
    const roles = user.roles.filter((item) => !item.role.deletedAt).map((item) => item.role.code);
    const permissions = [
      ...new Set(
        user.roles.flatMap((item) =>
          item.role.permissions
            .filter((rolePermission) => !rolePermission.permission.deletedAt)
            .map((rolePermission) => rolePermission.permission.code)
        )
      )
    ];

    return {
      accessToken: signAccessToken({
        sub: user.id,
        userId: user.userId,
        sessionId,
        permissions
      }),
      user: {
        id: user.id,
        userId: user.userId,
        roles,
        permissions,
        forcePasswordReset: user.forcePasswordReset
      }
    };
  }

  private buildSessionCreateInput(input: {
    sessionId: string;
    userId: string;
    familyId: string;
    refreshToken: string;
    meta: RequestMeta;
  }): {
    id: string;
    userId: string;
    refreshTokenHash: string;
    familyId: string;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: Prisma.InputJsonValue;
    expiresAt: Date;
  } {
    return {
      id: input.sessionId,
      userId: input.userId,
      refreshTokenHash: sha256(input.refreshToken),
      familyId: input.familyId,
      ...(input.meta.ipAddress ? { ipAddress: input.meta.ipAddress } : {}),
      ...(input.meta.userAgent ? { userAgent: input.meta.userAgent } : {}),
      ...(input.meta.deviceInfo ? { deviceInfo: input.meta.deviceInfo as Prisma.InputJsonValue } : {}),
      expiresAt: addDuration(new Date(), env.REFRESH_TOKEN_EXPIRES_IN)
    };
  }

  private verifyRefreshTokenOrThrow(refreshToken: string) {
    try {
      return verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }
}
