import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../common/errors/app-error';
import { verifyAccessToken } from '../common/utils/tokens';
import { prisma } from '../database/prisma';
import { RbacService } from '../modules/rbac/rbac.service';

const rbacService = new RbacService();

function getBearerToken(request: Request): string | null {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length);
}

export async function authenticate(request: Request, _response: Response, next: NextFunction): Promise<void> {
  try {
    const token = getBearerToken(request);

    if (!token) {
      throw new UnauthorizedError();
    }

    const payload = verifyAccessToken(token);
    const session = await prisma.authSession.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            userId: true,
            employeeId: true,
            status: true,
            deletedAt: true,
            employee: {
              select: {
                departmentId: true,
                department: true
              }
            }
          }
        }
      }
    });

    if (!session || session.user.deletedAt || session.user.status === 'INACTIVE') {
      throw new UnauthorizedError('Invalid session');
    }

    const accessProfile = await rbacService.getAccessProfile(session.user.id);

    request.user = {
      id: session.user.id,
      userId: session.user.userId,
      ...(session.user.employeeId ? { employeeId: session.user.employeeId } : {}),
      ...(session.user.employee?.departmentId ? { departmentId: session.user.employee.departmentId } : {}),
      ...(session.user.employee?.department ? { department: session.user.employee.department } : {}),
      sessionId: session.id,
      roles: accessProfile.roles,
      permissions: accessProfile.permissions,
      hierarchyLevel: accessProfile.hierarchyLevel
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }

    if (error instanceof Error && ['JsonWebTokenError', 'TokenExpiredError'].includes(error.name)) {
      next(new UnauthorizedError('Invalid access token'));
      return;
    }

    next(error);
  }
}
