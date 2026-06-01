import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '../../src/database/prisma';
import type { AuthenticatedUser } from '../../src/types/authenticated-user';

type JsonObject = Record<string, unknown>;

type AuditedRequest = Request & {
  user?: AuthenticatedUser;
};

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toJsonObject(value: unknown): JsonObject {
  if (isJsonObject(value)) {
    return value;
  }

  return {};
}

function computeDiff(previousValue: JsonObject, nextValue: JsonObject): JsonObject {
  const keys = new Set<string>([...Object.keys(previousValue), ...Object.keys(nextValue)]);
  const diff: JsonObject = {};

  for (const key of keys) {
    const previous = previousValue[key];
    const next = nextValue[key];

    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      diff[key] = {
        from: previous,
        to: next
      };
    }
  }

  return diff;
}

function getEntityId(params: Request['params']): string | null {
  const candidates = ['id', 'employeeId', 'userId', 'leaveId', 'jobId', 'candidateId', 'interviewId'];

  for (const key of candidates) {
    const value = params[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return null;
}

export function auditLog(entityType: string): (handler: RequestHandler) => RequestHandler {
  return function withAudit(handler: RequestHandler): RequestHandler {
    return function auditedHandler(request: Request, response: Response, next: NextFunction): void {
      const req = request as AuditedRequest;
      const actorId = req.user?.id ?? null;
      const entityId = getEntityId(request.params);
      const previousValue = toJsonObject(response.locals.previousValue ?? request.body);

      const originalJson = response.json.bind(response);
      let responseBody: unknown;

      response.json = ((body: unknown) => {
        responseBody = body;
        return originalJson(body);
      }) as Response['json'];

      response.on('finish', () => {
        const status = response.statusCode;

        if (status < 200 || status >= 400) {
          return;
        }

        const nextValue = toJsonObject(responseBody);
        const diff = computeDiff(previousValue, nextValue);

        void prisma.auditLog
          .create({
            data: {
              ...(actorId ? { actorId } : {}),
              ...(actorId ? { actorUserId: actorId } : {}),
              action: `${request.method.toUpperCase()} ${request.path}`,
              event: `${entityType}.${request.method.toLowerCase()}`,
              entityType,
              ...(entityId ? { entityId } : {}),
              previousValue,
              newValue: nextValue,
              metadata: diff,
              ipAddress: request.ip,
              userAgent: request.headers['user-agent']
            }
          })
          .catch(() => undefined);
      });

      try {
        const result = handler(request, response, next);
        if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
          void (result as PromiseLike<unknown>).catch(next);
        }
      } catch (error) {
        next(error);
      }
    };
  };
}
