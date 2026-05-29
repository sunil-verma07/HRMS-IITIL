// src/modules/recruitment/recruitment.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../../database/prisma";
import { ApplicationStage } from "@prisma/client";
import { sendSuccess, sendError } from "../../common/http/api-response";
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

// ---------------------------------------------------------------------------

export class RecruitmentController {
  // =========================================================================
  // JOBS
  // =========================================================================

  getJobs = async (req: Request, res: Response): Promise<Response> => {
    const query = parsePagination(req);
    const { search } = query;

    const where = {
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

    const [items, total] = await Promise.all([
      prisma.jobPosting.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: "desc" },
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
    const { id } = req.params;
    const job = await prisma.jobPosting.findFirst({
      where: { id, deletedAt: null },
    });
    if (!job) throw new NotFoundError("Job not found");
    return sendSuccess(res, "Job retrieved", job, HttpStatus.OK);
  };

  createJob = async (req: Request, res: Response): Promise<Response> => {
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
        publishedAt: publishedAt ? parseDate(publishedAt, "publishedAt") : null,
      },
    });

    return sendSuccess(res, "Job created", job, HttpStatus.CREATED);
  };

  updateJob = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
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
    const { id } = req.params;
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
    const { id } = req.params;
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
    const { id } = req.params;
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
    const { id } = req.params;
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
    const { id } = req.params;
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
    const { id } = req.params;
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
    const { id } = req.params;
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
    const { id } = req.params;
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
    const { id } = req.params;
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
    const { id } = req.params;
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
}