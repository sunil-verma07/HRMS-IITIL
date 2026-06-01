// src/modules/recruitment/recruitment.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { ApplicationStage } from "@prisma/client";
import { sendSuccess } from "../../common/http/api-response";
import { HttpStatus } from "../../common/http/status-codes";
import {
  parsePagination,
  paginated,
  pageArgs,
  currentUser,
} from "../../common/utils/controller-helpers";
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from "../../common/errors/app-error";
import {
  startOfDay,
  endOfDay,
  startOfToday,
  endOfToday,
  addDays,
} from "date-fns";

const DEFAULT_PIPELINE_STAGES = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "TECHNICAL",
  "OFFER",
  "HIRED",
  "REJECTED",
] as const;

const HR_ROLE_CODES = new Set([
  "HR",
  "HR_MANAGER",
  "HR_EXECUTIVE",
  "ADMIN",
  "PORTAL_ADMIN",
  "SUPER_ADMIN",
]);

function parseJsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_PIPELINE_STAGES];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function canViewJobs(user: ReturnType<typeof currentUser>): "self" | "department" | "all" {
  if (user.permissions.includes("recruitment.view.all")) {
    return "all";
  }

  if (user.permissions.includes("recruitment.view.department")) {
    return "department";
  }

  return "self";
}

function isHrScopedUser(user: ReturnType<typeof currentUser>): boolean {
  return user.roles.some((role) => HR_ROLE_CODES.has(role)) || user.permissions.some((permission) => permission.startsWith("recruitment."));
}

function getJobPipelineStages(job: { pipelineStages: unknown }): string[] {
  return parseJsonStringArray(job.pipelineStages);
}

function normalizeStage(stage: unknown): string {
  return typeof stage === "string" ? stage.trim().toUpperCase() : "";
}

// ---------------------------------------------------------------------------
// Allowed external application sources — extend as needed
// ---------------------------------------------------------------------------
export const APPLICATION_SOURCES = [
  "PORTAL",
  "EMAIL",
  "LINKEDIN",
  "REFERRAL",
  "AGENCY",
  "OTHER",
] as const;

export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Validate an ISO-8601 / parseable date string. */
function parseDate(value: unknown, fieldName: string): Date {
  if (!value || typeof value !== "string") {
    throw new BadRequestError(`${fieldName} must be a non-empty string`);
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new BadRequestError(`${fieldName} is not a valid date: "${value}"`);
  }
  return d;
}

/** Trim and lower-case an email, throw if malformed. */
function normalizeEmail(raw: unknown, fieldName = "email"): string {
  if (!raw || typeof raw !== "string") {
    throw new BadRequestError(`${fieldName} is required`);
  }
  const trimmed = raw.trim().toLowerCase();
  // RFC-5321 basic sanity check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new BadRequestError(`${fieldName} is not a valid email address`);
  }
  return trimmed;
}

function requireParam(value: string | undefined, label: string): string {
  if (!value) {
    throw new BadRequestError(`${label} is required`);
  }

  return value;
}

// ---------------------------------------------------------------------------

export class RecruitmentController {
  // =========================================================================
  // JOBS
  // =========================================================================

  getJobs = async (req: Request, res: Response): Promise<Response> => {
    const query = parsePagination(req);
    const { search } = query;
    const user = currentUser(req);
    const requestedScope = typeof req.query.scope === "string" ? req.query.scope : "";
    const scope = requestedScope === "all" || requestedScope === "department" || requestedScope === "self"
      ? requestedScope
      : canViewJobs(user);
    const statusFilter = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "";

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { department: { contains: search, mode: "insensitive" as const } },
              { location: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    if (statusFilter && ["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"].includes(statusFilter)) {
      where.status = statusFilter;
    }

    if (statusFilter !== "PUBLISHED") {
      if (scope === "self" && user.employeeId) {
        where.createdByHrId = user.employeeId;
      } else if (scope === "department" && user.department) {
        where.department = user.department;
      }
    }

    const [items, total] = await Promise.all([
      prisma.jobPosting.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
        include: {
          createdByHr: {
            select: { id: true, employeeId: true, firstName: true, lastName: true, department: true },
          },
        },
      }),
      prisma.jobPosting.count({ where }),
    ]);

    return sendSuccess(
      res,
      "Jobs retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  getJobById = async (req: Request, res: Response): Promise<Response> => {
    const id = requireParam(req.params.id, "Job id");
    const user = currentUser(req);
    const viewScope = canViewJobs(user);
    const accessConditions: Record<string, unknown>[] = [{ status: "PUBLISHED" }];

    if (viewScope === "all") {
      accessConditions.length = 0;
    } else {
      if (user.employeeId) {
        accessConditions.push({ createdByHrId: user.employeeId });
      }

      if (viewScope === "department" && user.department) {
        accessConditions.push({ department: user.department });
      }
    }

    const job = await prisma.jobPosting.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(accessConditions.length > 0 ? { OR: accessConditions } : {}),
      },
      include: {
        createdByHr: {
          select: { id: true, employeeId: true, firstName: true, lastName: true, department: true },
        },
      },
    });
    if (!job) throw new NotFoundError("Job not found");
    return sendSuccess(res, "Job retrieved", job, HttpStatus.OK);
  };

  createJob = async (req: Request, res: Response): Promise<Response> => {
    const user = currentUser(req);
    if (!user.employeeId) {
      throw new BadRequestError("Only linked HR employees can create jobs");
    }

    const {
      title,
      slug,
      description,
      department,
      experience,
      location,
      employmentType,
      salaryRange,
      skills,
      status,
      publishedAt,
    } = req.body;

    if (
      !title ||
      !slug ||
      !description ||
      !department ||
      !location ||
      !employmentType
    ) {
      throw new BadRequestError(
        "Missing required fields: title, slug, description, department, location, employmentType",
      );
    }

    const existing = await prisma.jobPosting.findUnique({ where: { slug } });
    if (existing) throw new ConflictError("Job with this slug already exists");

    const job = await prisma.jobPosting.create({
      data: {
        title,
        slug,
        description,
        department,
        experience,
        location,
        employmentType,
        salaryRange,
        skills: skills ?? [],
        status: status ?? "DRAFT",
        createdByHrId: user.employeeId,
        pipelineStages: parseJsonStringArray(req.body.pipelineStages ?? DEFAULT_PIPELINE_STAGES),
        publishedAt: publishedAt ? parseDate(publishedAt, "publishedAt") : null,
      },
      include: {
        createdByHr: {
          select: { id: true, employeeId: true, firstName: true, lastName: true, department: true },
        },
      },
    });

    return sendSuccess(res, "Job created", job, HttpStatus.CREATED);
  };

  updateJob = async (req: Request, res: Response): Promise<Response> => {
    const id = requireParam(req.params.id, "Job id");
    const existing = await prisma.jobPosting.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Job not found");

    const { slug, ...updateData } = req.body;

    if (slug && slug !== existing.slug) {
      const slugExists = await prisma.jobPosting.findUnique({ where: { slug } });
      if (slugExists) throw new ConflictError("Slug already in use");
    }

    const job = await prisma.jobPosting.update({
      where: { id },
      data: {
        ...updateData,
        slug: slug ?? existing.slug,
        updatedAt: new Date(),
      },
    });

    return sendSuccess(res, "Job updated", job, HttpStatus.OK);
  };

  deleteJob = async (req: Request, res: Response): Promise<Response> => {
    const id = requireParam(req.params.id, "Job id");
    const existing = await prisma.jobPosting.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Job not found");

    await prisma.jobPosting.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return sendSuccess(res, "Job deleted", null, HttpStatus.OK);
  };

  getPublishedJobs = async (req: Request, res: Response): Promise<Response> => {
    const query = parsePagination(req);
    const { search } = query;

    const where: Record<string, unknown> = {
      deletedAt: null,
      status: "PUBLISHED",
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { department: { contains: search, mode: "insensitive" as const } },
              { location: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.jobPosting.findMany({
        where,
        ...pageArgs(query),
        orderBy: { publishedAt: "desc" },
        include: {
          createdByHr: {
            select: { id: true, employeeId: true, firstName: true, lastName: true, department: true },
          },
        },
      }),
      prisma.jobPosting.count({ where }),
    ]);

    return sendSuccess(res, "Published jobs retrieved", paginated(items, total, query), HttpStatus.OK);
  };

  getJobCandidates = async (req: Request, res: Response): Promise<Response> => {
    const jobId = requireParam(req.params.jobId, "Job id");
    const job = await prisma.jobPosting.findFirst({
      where: { id: jobId, deletedAt: null },
    });

    if (!job) {
      throw new NotFoundError("Job not found");
    }

    const applications = await prisma.jobApplication.findMany({
      where: { jobId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: {
        candidate: true,
        interviews: {
          orderBy: { scheduledAt: "desc" },
          take: 1,
        },
      },
    });

    return sendSuccess(
      res,
      "Job candidates retrieved",
      {
        job,
        items: applications.map((application) => ({
          id: application.candidateId,
          applicationId: application.id,
          candidate: application.candidate,
          stage: application.stage,
          score: application.score,
          tags: application.tags,
          currentInterviewStatus: application.interviews[0]?.status ?? null,
          appliedAt: application.createdAt,
          notes: application.notes,
        })),
      },
      HttpStatus.OK,
    );
  };

  getCandidateDetail = async (req: Request, res: Response): Promise<Response> => {
    const id = requireParam(req.params.id, "Candidate id");
    const candidate = await prisma.candidate.findFirst({
      where: { id, deletedAt: null },
      include: {
        applications: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: {
            job: true,
            interviews: {
              orderBy: { scheduledAt: "desc" },
              include: {
                interviewer: {
                  select: { id: true, employeeId: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    });

    if (!candidate) throw new NotFoundError("Candidate not found");

    return sendSuccess(res, "Candidate detail retrieved", candidate, HttpStatus.OK);
  };

  getCandidateActivity = async (req: Request, res: Response): Promise<Response> => {
    const id = requireParam(req.params.id, "Candidate id");
    const [activityLogs, auditLogs] = await Promise.all([
      prisma.activityLog.findMany({
        where: {
          OR: [{ entityType: "candidate", entityId: id }, { entityType: "job-application" }, { entityType: "interview" }],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.auditLog.findMany({
        where: {
          OR: [{ entityType: "candidate", entityId: id }, { entityType: "job-application" }, { entityType: "interview" }],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return sendSuccess(
      res,
      "Candidate activity retrieved",
      {
        activityLogs,
        auditLogs,
      },
      HttpStatus.OK,
    );
  };

  updateCandidateStage = async (req: Request, res: Response): Promise<Response> => {
    const user = currentUser(req);
    const id = requireParam(req.params.id, "Candidate id");
    const { jobId, stage, score, tags } = req.body as {
      jobId?: string;
      stage?: string;
      score?: number;
      tags?: string[];
    };

    if (!jobId || !stage) {
      throw new BadRequestError("jobId and stage are required");
    }

    const job = await prisma.jobPosting.findFirst({ where: { id: jobId, deletedAt: null } });
    if (!job) throw new NotFoundError("Job not found");

    const candidate = await prisma.candidate.findFirst({ where: { id, deletedAt: null } });
    if (!candidate) throw new NotFoundError("Candidate not found");

    const pipelineStages = getJobPipelineStages(job);
    const nextStage = normalizeStage(stage);

    if (!pipelineStages.includes(nextStage)) {
      throw new BadRequestError(`Stage must be one of: ${pipelineStages.join(", ")}`);
    }

    const application = await prisma.jobApplication.findUnique({
      where: { jobId_candidateId: { jobId, candidateId: id } },
      include: { candidate: true, job: true },
    });

    if (!application) {
      throw new NotFoundError("Application not found for this candidate and job");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const previousStage = application.stage;
      const nextApplication = await tx.jobApplication.update({
        where: { id: application.id },
        data: {
          stage: nextStage as ApplicationStage,
          ...(typeof score === "number" ? { score } : {}),
          ...(Array.isArray(tags) ? { tags } : {}),
        },
        include: { candidate: true, job: true },
      });

      await tx.activityLog.create({
        data: {
          actorId: user.id,
          actorUserId: user.id,
          actorName: user.userId,
          action: "candidate.stage.update",
          entityType: "job-application",
          entityId: nextApplication.id,
          entityName: `${nextApplication.candidate.firstName} ${nextApplication.candidate.lastName}`,
          oldValues: { stage: previousStage },
          newValues: { stage: nextStage, jobId },
        },
      });

      const recipients = await tx.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            ...(application.job.createdByHrId
              ? [{ employeeId: application.job.createdByHrId }]
              : []),
          ],
        },
        select: { id: true },
      });

      if (recipients.length > 0) {
        await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            userId: recipient.id,
            type: "CANDIDATE_STAGE",
            channel: "IN_APP",
            title: "Candidate stage changed",
            message: `${candidate.firstName} ${candidate.lastName} moved to ${nextStage}`,
            body: `${candidate.firstName} ${candidate.lastName} moved to ${nextStage}`,
            metadata: {
              candidateId: candidate.id,
              jobId,
              previousStage,
              nextStage,
            },
          })),
        });
      }

      return nextApplication;
    });

    return sendSuccess(res, "Candidate stage updated", updated, HttpStatus.OK);
  };

  addCandidateNote = async (req: Request, res: Response): Promise<Response> => {
    const user = currentUser(req);
    const id = requireParam(req.params.id, "Candidate id");
    const { body } = req.body as { body?: string };

    if (!body || !body.trim()) {
      throw new BadRequestError("body is required");
    }

    const candidate = await prisma.candidate.findFirst({ where: { id, deletedAt: null } });
    if (!candidate) throw new NotFoundError("Candidate not found");

    const note = await prisma.activityLog.create({
      data: {
        actorId: user.id,
        actorUserId: user.id,
        actorName: user.userId,
        action: "candidate.note.add",
        entityType: "candidate",
        entityId: candidate.id,
        entityName: `${candidate.firstName} ${candidate.lastName}`,
        newValues: { note: body.trim() },
      },
    });

    return sendSuccess(res, "Candidate note added", note, HttpStatus.CREATED);
  };

  // =========================================================================
  // CANDIDATES
  // =========================================================================

  getCandidates = async (req: Request, res: Response): Promise<Response> => {
    const query = parsePagination(req);
    const { search } = query;

    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
      }),
      prisma.candidate.count({ where }),
    ]);

    return sendSuccess(
      res,
      "Candidates retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  getCandidateById = async (req: Request, res: Response): Promise<Response> => {
    const id = requireParam(req.params.id, "Candidate id");
    const candidate = await prisma.candidate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!candidate) throw new NotFoundError("Candidate not found");
    return sendSuccess(res, "Candidate retrieved", candidate, HttpStatus.OK);
  };

  createCandidate = async (req: Request, res: Response): Promise<Response> => {
    const {
      firstName,
      lastName,
      email: rawEmail,
      phone,
      linkedin,
      github,
      portfolio,
      experience,
      skills,
    } = req.body;

    if (!firstName || !lastName) {
      throw new BadRequestError(
        "Missing required fields: firstName, lastName, email",
      );
    }

    const email = normalizeEmail(rawEmail);

    const existing = await prisma.candidate.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing)
      throw new ConflictError("Candidate with this email already exists");

    const candidate = await prisma.candidate.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        linkedin,
        github,
        portfolio,
        experience,
        skills: skills ?? [],
      },
    });

    return sendSuccess(res, "Candidate created", candidate, HttpStatus.CREATED);
  };

  updateCandidate = async (req: Request, res: Response): Promise<Response> => {
    const id = requireParam(req.params.id, "Candidate id");
    const existing = await prisma.candidate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Candidate not found");

    const { email: rawEmail, ...rest } = req.body;

    let email: string | undefined;
    if (rawEmail) {
      email = normalizeEmail(rawEmail);
      if (email !== existing.email) {
        const emailExists = await prisma.candidate.findFirst({
          where: { email, deletedAt: null, id: { not: id } },
        });
        if (emailExists) throw new ConflictError("Email already in use");
      }
    }

    const candidate = await prisma.candidate.update({
      where: { id },
      data: { ...rest, ...(email ? { email } : {}), updatedAt: new Date() },
    });

    return sendSuccess(res, "Candidate updated", candidate, HttpStatus.OK);
  };

  deleteCandidate = async (req: Request, res: Response): Promise<Response> => {
    const id = requireParam(req.params.id, "Candidate id");
    const existing = await prisma.candidate.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Candidate not found");

    await prisma.candidate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return sendSuccess(res, "Candidate deleted", null, HttpStatus.OK);
  };

  // =========================================================================
  // APPLICATIONS
  // =========================================================================

  getApplications = async (req: Request, res: Response): Promise<Response> => {
    const query = parsePagination(req);
    const { search } = query;
    const { candidateId } = req.query as { candidateId?: string };

    const where: Record<string, unknown> = { deletedAt: null };

    if (candidateId) where.candidateId = candidateId;

    if (search) {
      where.OR = [
        {
          candidate: {
            firstName: { contains: search, mode: "insensitive" },
          },
        },
        {
          candidate: {
            lastName: { contains: search, mode: "insensitive" },
          },
        },
        { job: { title: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.jobApplication.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
        include: { candidate: true, job: true },
      }),
      prisma.jobApplication.count({ where }),
    ]);

    return sendSuccess(
      res,
      "Applications retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  getApplicationById = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    const id = requireParam(req.params.id, "Application id");
    const application = await prisma.jobApplication.findFirst({
      where: { id, deletedAt: null },
      include: { candidate: true, job: true, interviews: true },
    });
    if (!application) throw new NotFoundError("Application not found");
    return sendSuccess(res, "Application retrieved", application, HttpStatus.OK);
  };

  createApplication = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    const { jobId, candidateId, resumeUrl, coverLetter, stage } = req.body;

    if (!jobId || !candidateId) {
      throw new BadRequestError("Missing required fields: jobId, candidateId");
    }

    const [job, candidate] = await Promise.all([
      prisma.jobPosting.findFirst({ where: { id: jobId, deletedAt: null } }),
      prisma.candidate.findFirst({
        where: { id: candidateId, deletedAt: null },
      }),
    ]);

    if (!job) throw new NotFoundError("Job not found");
    if (!candidate) throw new NotFoundError("Candidate not found");

    const existing = await prisma.jobApplication.findUnique({
      where: { jobId_candidateId: { jobId, candidateId } },
    });
    if (existing)
      throw new ConflictError(
        "Application already exists for this job and candidate",
      );

    const application = await prisma.jobApplication.create({
      data: {
        jobId,
        candidateId,
        resumeUrl,
        coverLetter,
        stage: stage ?? "APPLIED",
      },
    });

    return sendSuccess(
      res,
      "Application created",
      application,
      HttpStatus.CREATED,
    );
  };

  updateApplication = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    const id = requireParam(req.params.id, "Application id");
    const existing = await prisma.jobApplication.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Application not found");

    const { stage } = req.body;

    const application = await prisma.jobApplication.update({
      where: { id },
      data: { stage, updatedAt: new Date() },
    });

    return sendSuccess(res, "Application updated", application, HttpStatus.OK);
  };

  deleteApplication = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    const id = requireParam(req.params.id, "Application id");
    const existing = await prisma.jobApplication.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Application not found");

    await prisma.jobApplication.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return sendSuccess(res, "Application deleted", null, HttpStatus.OK);
  };

  getPipeline = async (req: Request, res: Response): Promise<Response> => {
    const stages = Object.values(ApplicationStage);
    const pipelineData: Record<string, { count: number; items: unknown[] }> =
      {};

    // Run all stage queries in parallel — don't serialize with a for-loop
    await Promise.all(
      stages.map(async (stage) => {
        const [count, items] = await Promise.all([
          prisma.jobApplication.count({ where: { stage, deletedAt: null } }),
          prisma.jobApplication.findMany({
            where: { stage, deletedAt: null },
            take: 10,
            orderBy: { updatedAt: "desc" },
            include: { candidate: true, job: true },
          }),
        ]);
        pipelineData[stage] = { count, items };
      }),
    );

    return sendSuccess(
      res,
      "Pipeline data retrieved",
      pipelineData,
      HttpStatus.OK,
    );
  };

  // =========================================================================
  // QUICK-CREATE  — candidate + application in a single atomic-ish call
  //
  // Use-case: recruiter wants to schedule an interview for someone who applied
  // via email, LinkedIn, referral, or any off-platform channel.  Instead of
  // forcing them to first open Candidates, then Applications, then Interviews,
  // this endpoint wires all three steps in one round-trip so the schedule modal
  // can proceed immediately.
  //
  // Idempotency contract
  // ─────────────────────
  // • If a soft-deleted candidate record exists for the email we reuse it
  //   (restore it) rather than creating a duplicate ghost record.
  // • If an active application for jobId+candidateId already exists we return
  //   it with HTTP 200 — the caller should treat this as a success and proceed.
  // • A race between two concurrent identical requests is handled by catching
  //   the unique-constraint violation and re-fetching (optimistic upsert).
  // =========================================================================

  quickCreateCandidateAndApplication = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    const {
      firstName,
      lastName,
      email: rawEmail,
      phone,
      jobId,
      resumeUrl,
      source: rawSource,
      notes,
    } = req.body;

    // ── 1. Validate required scalar inputs ──────────────────────────────────
    if (!firstName || typeof firstName !== "string" || !firstName.trim()) {
      throw new BadRequestError("firstName is required");
    }
    if (!lastName || typeof lastName !== "string" || !lastName.trim()) {
      throw new BadRequestError("lastName is required");
    }
    if (!jobId || typeof jobId !== "string") {
      throw new BadRequestError("jobId is required");
    }

    const email = normalizeEmail(rawEmail);

    // Validate source — default to OTHER if omitted, reject unknown values
    const source: ApplicationSource =
      rawSource == null
        ? "OTHER"
        : APPLICATION_SOURCES.includes(rawSource)
          ? (rawSource as ApplicationSource)
          : (() => {
              throw new BadRequestError(
                `source must be one of: ${APPLICATION_SOURCES.join(", ")}`,
              );
            })();

    // ── 2. Verify the job exists and is still open ───────────────────────────
    const job = await prisma.jobPosting.findFirst({
      where: { id: jobId, deletedAt: null },
    });
    if (!job) throw new NotFoundError("Job not found");

    // Optional but valuable: warn when scheduling against a non-published job
    // We don't hard-block so that drafts can be used internally.
    const jobIsPublished = job.status === "PUBLISHED";

    // ── 3. Resolve candidate — active > soft-deleted > create ───────────────
    let candidate = await prisma.candidate.findFirst({
      where: { email, deletedAt: null },
    });

    if (!candidate) {
      // Check for a soft-deleted record we can restore
      const deleted = await prisma.candidate.findFirst({
        where: { email, deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" }, // most recently deleted first
      });

      if (deleted) {
        // Restore and refresh profile data
        candidate = await prisma.candidate.update({
          where: { id: deleted.id },
          data: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone ?? deleted.phone,
            deletedAt: null,
            updatedAt: new Date(),
          },
        });
      } else {
        candidate = await prisma.candidate.create({
          data: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email,
            phone: phone ?? null,
            skills: [],
          },
        });
      }
    }

    // ── 4. Resolve application — idempotent upsert ───────────────────────────
    const existingApp = await prisma.jobApplication.findUnique({
      where: {
        jobId_candidateId: { jobId, candidateId: candidate.id },
      },
    });

    if (existingApp) {
      // If the existing record was soft-deleted, restore it
      const application =
        existingApp.deletedAt !== null
          ? await prisma.jobApplication.update({
              where: { id: existingApp.id },
              data: {
                deletedAt: null,
                source,
                resumeUrl: resumeUrl ?? existingApp.resumeUrl,
                notes: notes ?? (existingApp as any).notes,
                updatedAt: new Date(),
              },
            })
          : existingApp;

      return sendSuccess(
        res,
        "Candidate already has an application for this job",
        {
          candidate,
          application,
          jobIsPublished,
          action: "existing" as const,
        },
        HttpStatus.OK, // 200, not 409 — caller should proceed to schedule
      );
    }

    // Create new application
    // Wrap in try/catch to handle the rare concurrent-insert race condition
    let application: Awaited<
      ReturnType<typeof prisma.jobApplication.create>
    >;
    try {
      application = await prisma.jobApplication.create({
        data: {
          jobId,
          candidateId: candidate.id,
          stage: "APPLIED",
          source,
          resumeUrl: resumeUrl ?? null,
          notes: notes ?? null,
        } as any,
      });
    } catch (err: any) {
      // Unique constraint violation — another request beat us to it
      if (err?.code === "P2002") {
        const racedApp = await prisma.jobApplication.findUnique({
          where: {
            jobId_candidateId: { jobId, candidateId: candidate.id },
          },
        });
        if (!racedApp) throw err; // something truly unexpected — re-throw
        return sendSuccess(
          res,
          "Application already exists (concurrent request)",
          {
            candidate,
            application: racedApp,
            jobIsPublished,
            action: "existing" as const,
          },
          HttpStatus.OK,
        );
      }
      throw err;
    }

    return sendSuccess(
      res,
      "Candidate and application created successfully",
      {
        candidate,
        application,
        jobIsPublished,
        action: "created" as const,
      },
      HttpStatus.CREATED,
    );
  };

  // =========================================================================
  // INTERVIEWS
  // =========================================================================

  getInterviews = async (req: Request, res: Response): Promise<Response> => {
    const query = parsePagination(req);
    const [items, total] = await Promise.all([
      prisma.interview.findMany({
        where: { deletedAt: null },
        ...pageArgs(query),
        orderBy: { scheduledAt: "desc" },
        include: {
          interviewer: {
            select: { employeeId: true, firstName: true, lastName: true },
          },
          application: { include: { candidate: true, job: true } },
        },
      }),
      prisma.interview.count({ where: { deletedAt: null } }),
    ]);

    return sendSuccess(
      res,
      "Interviews retrieved",
      paginated(items, total, query),
      HttpStatus.OK,
    );
  };

  getInterviewById = async (req: Request, res: Response): Promise<Response> => {
    const id = requireParam(req.params.id, "Interview id");
    const interview = await prisma.interview.findFirst({
      where: { id, deletedAt: null },
      include: {
        interviewer: true,
        application: { include: { candidate: true, job: true } },
      },
    });
    if (!interview) throw new NotFoundError("Interview not found");
    return sendSuccess(res, "Interview retrieved", interview, HttpStatus.OK);
  };

  createInterview = async (req: Request, res: Response): Promise<Response> => {
    const {
      applicationId,
      interviewerId,
      scheduledAt: scheduledAtRaw,
      durationMins,
      mode,
      meetingLink,
      status,
    } = req.body;

    if (!applicationId || !interviewerId || !scheduledAtRaw || !mode) {
      throw new BadRequestError(
        "Missing required fields: applicationId, interviewerId, scheduledAt, mode",
      );
    }

    const scheduledAt = parseDate(scheduledAtRaw, "scheduledAt");

    // Reject scheduling in the past (allow a 60-second grace window for clock skew)
    if (scheduledAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestError("Cannot schedule an interview in the past");
    }

    const [application, interviewer] = await Promise.all([
      prisma.jobApplication.findFirst({
        where: { id: applicationId, deletedAt: null },
      }),
      prisma.employee.findFirst({
        where: { id: interviewerId, deletedAt: null },
      }),
    ]);

    if (!application) throw new NotFoundError("Application not found");
    if (!interviewer) throw new NotFoundError("Interviewer not found");

    // Prevent double-booking the same interviewer at the exact same time
    const clash = await prisma.interview.findFirst({
      where: {
        interviewerId,
        deletedAt: null,
        status: { notIn: ["CANCELLED"] as any[] },
        scheduledAt,
      },
    });
    if (clash) {
      throw new ConflictError(
        "Interviewer already has an interview scheduled at this exact time",
      );
    }

    const interview = await prisma.interview.create({
      data: {
        applicationId,
        interviewerId,
        scheduledAt,
        durationMins: durationMins ?? 60,
        mode,
        meetingLink: meetingLink ?? null,
        status: status ?? "SCHEDULED",
      },
    });

    return sendSuccess(res, "Interview created", interview, HttpStatus.CREATED);
  };

  updateInterview = async (req: Request, res: Response): Promise<Response> => {
    const id = requireParam(req.params.id, "Interview id");
    const existing = await prisma.interview.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Interview not found");

    const { scheduledAt: scheduledAtRaw, ...rest } = req.body;

    let scheduledAt: Date | undefined;
    if (scheduledAtRaw) {
      scheduledAt = parseDate(scheduledAtRaw, "scheduledAt");
      if (scheduledAt.getTime() < Date.now() - 60_000) {
        throw new BadRequestError("Cannot reschedule to a time in the past");
      }
    }

    // Prevent double-booking on reschedule
    if (scheduledAt) {
      const clash = await prisma.interview.findFirst({
        where: {
          interviewerId: existing.interviewerId,
          deletedAt: null,
          status: { notIn: ["CANCELLED"] as any[] },
          scheduledAt,
          id: { not: id }, // exclude self
        },
      });
      if (clash) {
        throw new ConflictError(
          "Interviewer already has an interview scheduled at this exact time",
        );
      }
    }

    const interview = await prisma.interview.update({
      where: { id },
      data: {
        ...rest,
        ...(scheduledAt ? { scheduledAt } : {}),
        updatedAt: new Date(),
      },
    });

    return sendSuccess(res, "Interview updated", interview, HttpStatus.OK);
  };

  deleteInterview = async (req: Request, res: Response): Promise<Response> => {
    const id = requireParam(req.params.id, "Interview id");
    const existing = await prisma.interview.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Interview not found");

    await prisma.interview.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return sendSuccess(res, "Interview deleted", null, HttpStatus.OK);
  };

  getInterviewAnalytics = async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    const now = new Date();
    const todayStart = startOfToday();
    const todayEnd = endOfToday();
    const upcomingEnd = addDays(now, 30);

    const [
      todayCount,
      upcomingCount,
      pendingFeedbackCount,
      completedCount,
      cancelledCount,
      selectedCount,
    ] = await Promise.all([
      prisma.interview.count({
        where: {
          deletedAt: null,
          scheduledAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.interview.count({
        where: {
          deletedAt: null,
          status: { in: ["SCHEDULED", "RESCHEDULED"] as any[] },
          scheduledAt: { gt: now, lte: upcomingEnd },
        },
      }),
      prisma.interview.count({
        where: {
          deletedAt: null,
          status: "FEEDBACK_PENDING" as any,
        },
      }),
      prisma.interview.count({
        where: { deletedAt: null, status: "COMPLETED" },
      }),
      prisma.interview.count({
        where: { deletedAt: null, status: "CANCELLED" },
      }),
      prisma.jobApplication.count({
        where: { deletedAt: null, stage: "SELECTED" },
      }),
    ]);

    return sendSuccess(
      res,
      "Interview analytics retrieved",
      {
        todayCount,
        upcomingCount,
        pendingFeedbackCount,
        completedCount,
        selectedCount,
        cancelledCount,
      },
      HttpStatus.OK,
    );
  };

  onboarding = async (_req: Request, res: Response): Promise<Response> => {
    return sendSuccess(
      res,
      "Onboarding recruitment summary retrieved",
      {
        items: [],
        meta: {
          total: 0,
        },
      },
      HttpStatus.OK,
    );
  };
}