import type { Request, Response } from 'express';
import { EmployeeStatus, OnboardingProgressStatus, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import { sendSuccess } from '../../common/http/api-response';
import { HttpStatus } from '../../common/http/status-codes';
import type { AuthenticatedUser } from '../../types/authenticated-user';
import { FileStorageService } from '../../services/storage/file-storage.service';

const storage = new FileStorageService();

const defaultConfig = {
  requiredDocuments: [],
  mandatoryFields: [],
  optionalFields: [],
  steps: [
    { key: 'personal', title: 'Personal Info', required: true },
    { key: 'documents', title: 'Documents', required: true },
    { key: 'employment', title: 'Employment', required: true },
    { key: 'review', title: 'Review', required: true },
    { key: 'approval', title: 'Approval', required: true },
  ],
};

function currentUser(request: Request): AuthenticatedUser {
  const user = request.user as AuthenticatedUser | undefined;
  if (!user) {
    throw new ForbiddenError('Authentication required');
  }

  return user;
}

function requireEmployeeId(user: AuthenticatedUser): string {
  if (!user.employeeId) {
    throw new BadRequestError('Employee record required');
  }

  return user.employeeId;
}

function requireParam(value: string | undefined, label: string): string {
  if (!value) {
    throw new BadRequestError(`${label} is required`);
  }

  return value;
}

function isSuperAdmin(user: AuthenticatedUser): boolean {
  return user.roles.includes('SUPER_ADMIN') || user.permissions.includes('onboarding.manage.all');
}

function isOnboardingAdmin(user: AuthenticatedUser): boolean {
  return isSuperAdmin(user) || user.permissions.includes('onboarding.manage.department');
}

export class OnboardingController {
  getConfig = async (_request: Request, response: Response): Promise<Response> => {
    const config = await prisma.onboardingConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
      include: {
        updatedBy: {
          select: { id: true, employeeId: true, firstName: true, lastName: true },
        },
      },
    });

    return sendSuccess(response, 'Onboarding config retrieved', config ?? defaultConfig, HttpStatus.OK);
  };

  updateConfig = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    if (!isSuperAdmin(user)) {
      throw new ForbiddenError('Super Admin only');
    }

    const body = request.body as {
      requiredDocuments?: Prisma.InputJsonValue;
      mandatoryFields?: Prisma.InputJsonValue;
      optionalFields?: Prisma.InputJsonValue;
      steps?: Prisma.InputJsonValue;
    };

    const config = await prisma.onboardingConfig.upsert({
      where: { id: (await prisma.onboardingConfig.findFirst())?.id ?? '00000000-0000-0000-0000-000000000000' },
      update: {
        requiredDocuments: body.requiredDocuments ?? defaultConfig.requiredDocuments,
        mandatoryFields: body.mandatoryFields ?? defaultConfig.mandatoryFields,
        optionalFields: body.optionalFields ?? defaultConfig.optionalFields,
        steps: body.steps ?? defaultConfig.steps,
        updatedById: user.employeeId ?? null,
      },
      create: {
        requiredDocuments: body.requiredDocuments ?? defaultConfig.requiredDocuments,
        mandatoryFields: body.mandatoryFields ?? defaultConfig.mandatoryFields,
        optionalFields: body.optionalFields ?? defaultConfig.optionalFields,
        steps: body.steps ?? defaultConfig.steps,
        updatedById: user.employeeId ?? null,
      },
    });

    return sendSuccess(response, 'Onboarding config updated', config, HttpStatus.OK);
  };

  getMyProgress = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    const employeeId = requireEmployeeId(user);

    const progress = await prisma.onboardingProgress.upsert({
      where: { employeeId },
      update: {},
      create: {
        employeeId,
        currentStep: 1,
        completedSteps: [],
        submittedDocuments: { documents: [], files: [] },
        status: OnboardingProgressStatus.IN_PROGRESS,
      },
    });

    return sendSuccess(response, 'Onboarding progress retrieved', progress, HttpStatus.OK);
  };

  updateMyProgress = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    const employeeId = requireEmployeeId(user);
    const progress = await prisma.onboardingProgress.findUnique({ where: { employeeId } });

    if (progress?.status === OnboardingProgressStatus.SUBMITTED) {
      throw new BadRequestError('Onboarding has been submitted and cannot be edited');
    }

    const body = request.body as {
      currentStep?: number;
      completedSteps?: string[];
      submittedDocuments?: Prisma.InputJsonValue;
      status?: OnboardingProgressStatus;
    };

    const updated = await prisma.onboardingProgress.upsert({
      where: { employeeId },
      update: {
        ...(typeof body.currentStep === 'number' ? { currentStep: body.currentStep } : {}),
        ...(Array.isArray(body.completedSteps) ? { completedSteps: body.completedSteps } : {}),
        ...(body.submittedDocuments !== undefined ? { submittedDocuments: body.submittedDocuments } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
      create: {
        employeeId,
        currentStep: body.currentStep ?? 1,
        completedSteps: body.completedSteps ?? [],
        submittedDocuments: body.submittedDocuments ?? { documents: [], files: [] },
        status: body.status ?? OnboardingProgressStatus.IN_PROGRESS,
      },
    });

    return sendSuccess(response, 'Onboarding progress saved', updated, HttpStatus.OK);
  };

  submit = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    const employeeId = requireEmployeeId(user);
    const progress = await prisma.onboardingProgress.findUnique({ where: { employeeId } });

    if (!progress) {
      throw new NotFoundError('Onboarding progress not found');
    }

    const submitted = await prisma.onboardingProgress.update({
      where: { employeeId },
      data: { status: OnboardingProgressStatus.SUBMITTED },
    });

    return sendSuccess(response, 'Onboarding submitted', submitted, HttpStatus.OK);
  };

  review = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    if (!isOnboardingAdmin(user)) {
      throw new ForbiddenError('Insufficient permissions');
    }

    const employeeId = requireParam(request.params.employeeId, 'Employee id');
    const body = request.body as { decision?: 'APPROVED' | 'REJECTED'; notes?: string };

    if (!body.decision) {
      throw new BadRequestError('decision is required');
    }

    const progress = await prisma.onboardingProgress.findUnique({ where: { employeeId } });
    if (!progress) {
      throw new NotFoundError('Onboarding progress not found');
    }

    const reviewed = await prisma.onboardingProgress.update({
      where: { employeeId },
      data: {
        status: body.decision === 'APPROVED' ? OnboardingProgressStatus.APPROVED : OnboardingProgressStatus.REJECTED,
        reviewNotes: body.notes ?? null,
        reviewedById: user.employeeId ?? null,
      },
    });

    return sendSuccess(response, 'Onboarding reviewed', reviewed, HttpStatus.OK);
  };

  activate = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    if (!isOnboardingAdmin(user)) {
      throw new ForbiddenError('Insufficient permissions');
    }

    const employeeId = requireParam(request.params.employeeId, 'Employee id');
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: { status: EmployeeStatus.ACTIVE },
    });

    return sendSuccess(response, 'Employee activated', updatedEmployee, HttpStatus.OK);
  };

  uploadDocument = async (request: Request, response: Response): Promise<Response> => {
    const user = currentUser(request);
    const employeeId = requireEmployeeId(user);

    if (!request.file) {
      throw new BadRequestError('File is required');
    }

    const result = await storage.client.upload({
      buffer: request.file.buffer,
      fileName: request.file.originalname,
      mimeType: request.file.mimetype,
      folder: `onboarding/${employeeId}`,
    });

    const document = await prisma.document.create({
      data: {
        provider: result.provider,
        key: result.key,
        url: result.url,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes ?? null,
        uploadedById: user.id,
        entityType: 'onboarding',
        entityId: employeeId,
      },
    });

    const progress = await prisma.onboardingProgress.upsert({
      where: { employeeId },
      update: {
        submittedDocuments: {
          ...(await prisma.onboardingProgress.findUnique({ where: { employeeId } }))?.submittedDocuments as Record<string, unknown> ?? {},
          lastUploadedDocument: document,
        },
      },
      create: {
        employeeId,
        currentStep: 1,
        completedSteps: [],
        submittedDocuments: { lastUploadedDocument: document },
        status: OnboardingProgressStatus.IN_PROGRESS,
      },
    });

    return sendSuccess(response, 'Document uploaded', { document, progress }, HttpStatus.CREATED);
  };
}
