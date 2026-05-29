import { prisma } from "../database/prisma";

const REMIND_MINUTES = 15;
const WINDOW_SECONDS = 60; // one-minute window, matches cron frequency

function notificationWindow(): { gte: Date; lte: Date } {
  const now = Date.now();
  const targetMs = now + REMIND_MINUTES * 60 * 1000;
  return {
    gte: new Date(targetMs - WINDOW_SECONDS * 1000),
    lte: new Date(targetMs + WINDOW_SECONDS * 1000),
  };
}

async function runReminders(): Promise<void> {
  const window = notificationWindow();

  const interviews = await prisma.interview.findMany({
    where: {
      deletedAt: null,
      status: { in: ["SCHEDULED", "RESCHEDULED"] },
      scheduledAt: window,
      notifiedAt: null,
    },
    include: {
      interviewer: {
        select: { id: true, firstName: true, lastName: true },
      },
      application: {
        select: {
          candidate: { select: { firstName: true, lastName: true } },
          job: { select: { title: true } },
        },
      },
    },
  });

  if (interviews.length === 0) return;

  type NotificationInput = {
    userId: string;
    type: string;
    referenceId: string;
    message: string;
    isRead: boolean;
  };

  const notifications: NotificationInput[] = [];

  for (const interview of interviews) {
    const candidateName = interview.application?.candidate
      ? `${interview.application.candidate.firstName} ${interview.application.candidate.lastName}`
      : "the candidate";
    const jobTitle = interview.application?.job?.title ?? "Interview";
    const message = `${jobTitle} with ${candidateName} starts in ${REMIND_MINUTES} minutes.`;

    if (interview.interviewer?.id) {
      notifications.push({
        userId: interview.interviewer.id,
        type: "INTERVIEW_REMINDER",
        referenceId: interview.id,
        message,
        isRead: false,
      });
    }
  }

  if (notifications.length === 0) return;

  await prisma.$transaction([
    prisma.notification.createMany({ data: notifications, skipDuplicates: true }),
    prisma.interview.updateMany({
      where: { id: { in: interviews.map((iv) => iv.id) } },
      data: { notifiedAt: new Date() },
    }),
  ]);

  console.log(
    `[interview-worker] Sent ${notifications.length} reminder(s) for ${interviews.length} interview(s)`,
  );
}

let workerTimer: ReturnType<typeof setInterval> | null = null;

export function startInterviewNotificationWorker(): void {
  if (workerTimer) return; // prevent double-start

  // Run immediately on start, then every 60 seconds
  runReminders().catch((err) =>
    console.error("[interview-worker] Initial run failed:", err),
  );

  workerTimer = setInterval(() => {
    runReminders().catch((err) =>
      console.error("[interview-worker] Run failed:", err),
    );
  }, 60_000);

  console.log("[interview-worker] Started — checking every 60s");
}

export function stopInterviewNotificationWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    console.log("[interview-worker] Stopped");
  }
}