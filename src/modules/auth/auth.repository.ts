import type { Prisma, UserStatus } from '@prisma/client';
import { prisma, type TransactionClient } from '../../database/prisma';

export type UserWithAccess = Prisma.UserGetPayload<{
  include: {
    roles: {
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true;
              };
            };
          };
        };
      };
    };
  };
}>;

type SessionCreateInput = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  familyId: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Prisma.InputJsonValue;
  expiresAt: Date;
};

export class AuthRepository {
  findUserByUserId(userId: string): Promise<UserWithAccess | null> {
    return prisma.user.findFirst({
      where: {
        userId,
        deletedAt: null
      },
      include: this.userAccessInclude()
    });
  }

  findUserById(id: string, tx: TransactionClient | typeof prisma = prisma): Promise<UserWithAccess | null> {
    return tx.user.findFirst({
      where: {
        id,
        deletedAt: null
      },
      include: this.userAccessInclude()
    });
  }

  updateLoginFailure(userId: string, failedLoginAttempts: number, lockedUntil: Date | null): Promise<void> {
    return prisma.user
      .update({
        where: { id: userId },
        data: {
          failedLoginAttempts,
          lockedUntil,
          ...(lockedUntil ? { status: 'LOCKED' as const } : {})
        }
      })
      .then(() => undefined);
  }

  resetLoginFailures(userId: string, status?: UserStatus): Promise<void> {
    return prisma.user
      .update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          ...(status ? { status } : {})
        }
      })
      .then(() => undefined);
  }

  createSession(input: SessionCreateInput, tx: TransactionClient | typeof prisma = prisma): Promise<void> {
    return tx.authSession
      .create({
        data: input
      })
      .then(() => undefined);
  }

  findSessionById(id: string, tx: TransactionClient | typeof prisma = prisma) {
    return tx.authSession.findUnique({
      where: { id },
      include: {
        user: {
          include: this.userAccessInclude()
        }
      }
    });
  }

  revokeSession(id: string, tx: TransactionClient | typeof prisma = prisma, replacedById?: string): Promise<void> {
    return tx.authSession
      .update({
        where: { id },
        data: {
          revokedAt: new Date(),
          ...(replacedById ? { replacedById } : {})
        }
      })
      .then(() => undefined);
  }

  revokeSessionFamily(familyId: string, tx: TransactionClient | typeof prisma = prisma): Promise<void> {
    return tx.authSession
      .updateMany({
        where: {
          familyId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      })
      .then(() => undefined);
  }

  revokeUserSessions(userId: string, tx: TransactionClient | typeof prisma = prisma, exceptSessionId?: string): Promise<void> {
    return tx.authSession
      .updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(exceptSessionId ? { id: { not: exceptSessionId } } : {})
        },
        data: {
          revokedAt: new Date()
        }
      })
      .then(() => undefined);
  }

  updatePassword(userId: string, passwordHash: string, tx: TransactionClient | typeof prisma = prisma): Promise<void> {
    return tx.user
      .update({
        where: { id: userId },
        data: {
          passwordHash,
          forcePasswordReset: false,
          status: 'ACTIVE',
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      })
      .then(() => undefined);
  }

  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    return prisma.passwordResetToken
      .create({
        data: {
          userId,
          tokenHash,
          expiresAt
        }
      })
      .then(() => undefined);
  }

  findActivePasswordResetToken(tokenHash: string) {
    return prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: new Date()
        }
      }
    });
  }

  markPasswordResetTokenUsed(id: string, tx: TransactionClient | typeof prisma = prisma): Promise<void> {
    return tx.passwordResetToken
      .update({
        where: { id },
        data: { usedAt: new Date() }
      })
      .then(() => undefined);
  }

  createAuditLog(data: Prisma.AuditLogUncheckedCreateInput): Promise<void> {
    return prisma.auditLog.create({ data }).then(() => undefined);
  }

  private userAccessInclude() {
    return {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    } satisfies Prisma.UserInclude;
  }
}
