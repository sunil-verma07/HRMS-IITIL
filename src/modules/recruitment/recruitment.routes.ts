// src/modules/recruitment/recruitment.routes.ts
import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { RecruitmentController } from "./recruitment.controller";

const router = Router();
const ctrl = new RecruitmentController();

// Jobs
router.get(
  "/jobs",
  authenticate,
  authorize("job.read"),
  asyncHandler(ctrl.getJobs),
);
router.get(
  "/jobs/published",
  authenticate,
  authorize("job.read"),
  asyncHandler(ctrl.getPublishedJobs),
);
router.get(
  "/jobs/:id",
  authenticate,
  authorize("job.read"),
  asyncHandler(ctrl.getJobById),
);
router.get(
  "/jobs/:jobId/candidates",
  authenticate,
  authorize("candidate.read"),
  asyncHandler(ctrl.getJobCandidates),
);
router.post(
  "/jobs",
  authenticate,
  authorize("job.write"),
  asyncHandler(ctrl.createJob),
);
router.patch(
  "/jobs/:id",
  authenticate,
  authorize("job.write"),
  asyncHandler(ctrl.updateJob),
);
router.delete(
  "/jobs/:id",
  authenticate,
  authorize("job.write"),
  asyncHandler(ctrl.deleteJob),
);

// Candidates
router.get(
  "/candidates",
  authenticate,
  authorize("candidate.read"),
  asyncHandler(ctrl.getCandidates),
);
router.get(
  "/candidates/:id",
  authenticate,
  authorize("candidate.read"),
  asyncHandler(ctrl.getCandidateById),
);
router.get(
  "/candidates/:id/detail",
  authenticate,
  authorize("candidate.read"),
  asyncHandler(ctrl.getCandidateDetail),
);
router.get(
  "/candidates/:id/activity",
  authenticate,
  authorize("candidate.read"),
  asyncHandler(ctrl.getCandidateActivity),
);
router.post(
  "/candidates",
  authenticate,
  authorize("candidate.write"),
  asyncHandler(ctrl.createCandidate),
);
router.patch(
  "/candidates/:id",
  authenticate,
  authorize("candidate.write"),
  asyncHandler(ctrl.updateCandidate),
);
router.patch(
  "/candidates/:id/stage",
  authenticate,
  authorize("application.write"),
  asyncHandler(ctrl.updateCandidateStage),
);
router.post(
  "/candidates/:id/notes",
  authenticate,
  authorize("candidate.write"),
  asyncHandler(ctrl.addCandidateNote),
);
router.delete(
  "/candidates/:id",
  authenticate,
  authorize("candidate.write"),
  asyncHandler(ctrl.deleteCandidate),
);
router.post(
  "/quick-create",
  authenticate,
  authorize("candidate.write"),
  asyncHandler(ctrl.quickCreateCandidateAndApplication),
);

// Applications
router.get(
  "/applications",
  authenticate,
  authorize("application.read"),
  asyncHandler(ctrl.getApplications),
);
router.get(
  "/applications/pipeline",
  authenticate,
  authorize("application.read"),
  asyncHandler(ctrl.getPipeline),
);
router.get(
  "/applications/:id",
  authenticate,
  authorize("application.read"),
  asyncHandler(ctrl.getApplicationById),
);
router.post(
  "/applications",
  authenticate,
  authorize("application.write"),
  asyncHandler(ctrl.createApplication),
);
router.patch(
  "/applications/:id",
  authenticate,
  authorize("application.write"),
  asyncHandler(ctrl.updateApplication),
);
router.delete(
  "/applications/:id",
  authenticate,
  authorize("application.write"),
  asyncHandler(ctrl.deleteApplication),
);

// Interviews
router.get(
  "/interviews",
  authenticate,
  authorize("interview.read"),
  asyncHandler(ctrl.getInterviews),
);
router.get(
  "/interviews/analytics",
  authenticate,
  authorize("interview.read"),
  asyncHandler(ctrl.getInterviewAnalytics),
);
router.get(
  "/interviews/:id",
  authenticate,
  authorize("interview.read"),
  asyncHandler(ctrl.getInterviewById),
);
router.post(
  "/interviews",
  authenticate,
  authorize("interview.write"),
  asyncHandler(ctrl.createInterview),
);
router.patch(
  "/interviews/:id",
  authenticate,
  authorize("interview.write"),
  asyncHandler(ctrl.updateInterview),
);
router.delete(
  "/interviews/:id",
  authenticate,
  authorize("interview.write"),
  asyncHandler(ctrl.deleteInterview),
);



// Onboarding (fix permission)
router.get(
  "/onboarding",
  authenticate,
  authorize("onboarding.read"),
  asyncHandler(ctrl.onboarding),
);

export { router as recruitmentRoutes };
