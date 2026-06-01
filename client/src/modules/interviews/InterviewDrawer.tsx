import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  X,
  ExternalLink,
  Calendar,
  Clock,
  Monitor,
  User,
  Briefcase,
  FileText,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useInterviewStore } from "./useInterviewStore";
import { useInterviewDetail, useUpdateInterview } from "./useInterviews";
import { useForm } from "react-hook-form";

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  COMPLETED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  CANCELLED: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  NO_SHOW: "bg-orange-500/15 text-orange-300 border-orange-500/25",
  RESCHEDULED: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  FEEDBACK_PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/25",
};

function DetailRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-white/[0.04]">
        <Icon size={12} className="text-white/40" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            {value} <ExternalLink size={11} />
          </a>
        ) : (
          <p className="text-sm text-white/70 truncate">{value}</p>
        )}
      </div>
    </div>
  );
}

function FeedbackForm({ interviewId }: { interviewId: string }) {
  const updateMutation = useUpdateInterview();
  const { register, handleSubmit, reset } = useForm<{ feedback: string }>({
    defaultValues: { feedback: "" },
  });

  const onSubmit = async (values: { feedback: string }) => {
    if (!values.feedback.trim()) return;
    await updateMutation.mutateAsync({
      id: interviewId,
      payload: { feedback: values.feedback, status: "FEEDBACK_PENDING" },
    });
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      <Textarea
        placeholder="Add interviewer feedback, notes, or assessment…"
        rows={4}
        {...register("feedback")}
        className="border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/25 resize-none"
      />
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={updateMutation.isPending}
          className="bg-cyan-600 hover:bg-cyan-500 text-white"
        >
          {updateMutation.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            "Save Feedback"
          )}
        </Button>
      </div>
    </form>
  );
}

export function InterviewDrawer() {
  const { drawerOpen, drawerInterview, closeDrawer, openEditModal } =
    useInterviewStore();

  const { data: detail, isLoading } = useInterviewDetail(
    drawerOpen ? drawerInterview?.id ?? null : null,
  );

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    if (drawerOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [drawerOpen, closeDrawer]);

  const interview = detail ?? drawerInterview;

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={closeDrawer}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[#0d0d0f] border-l border-white/10 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">
                  Interview Details
                </h2>
                {interview && (
                  <Badge
                    className={cn(
                      "border text-[10px] px-2 py-0.5",
                      STATUS_STYLES[interview.status] ??
                        "bg-white/10 text-white/50 border-white/10",
                    )}
                  >
                    {interview.status.replace("_", " ")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {interview && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      closeDrawer();
                      openEditModal(interview as any);
                    }}
                    className="h-7 px-2.5 text-xs text-white/40 hover:text-white"
                  >
                    Edit
                  </Button>
                )}
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              {isLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-white/30" />
                </div>
              )}

              {!isLoading && interview && (
                <>
                  <section>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/8">
                      <div className="h-10 w-10 rounded-full bg-white/8 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-white/60">
                          {interview.application?.candidate
                            ? `${interview.application.candidate.firstName[0]}${interview.application.candidate.lastName[0]}`
                            : "?"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white/90 truncate">
                          {interview.application?.candidate
                            ? `${interview.application.candidate.firstName} ${interview.application.candidate.lastName}`
                            : "Unknown Candidate"}
                        </p>
                        <p className="text-xs text-white/40 truncate">
                          {interview.application?.job?.title ?? "—"}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-[10px] text-white/30 uppercase tracking-widest">
                      Interview Details
                    </h3>
                    <div className="space-y-3.5">
                      <DetailRow
                        icon={Calendar}
                        label="Date"
                        value={format(new Date(interview.scheduledAt), "EEEE, MMMM d yyyy")}
                      />
                      <DetailRow
                        icon={Clock}
                        label="Time"
                        value={format(new Date(interview.scheduledAt), "HH:mm 'UTC'")}
                      />
                      <DetailRow
                        icon={Monitor}
                        label="Mode"
                        value={interview.mode}
                      />
                      {(interview as any).meetingLink && (
                        <DetailRow
                          icon={LinkIcon}
                          label="Meeting Link"
                          value={(interview as any).meetingLink}
                          href={(interview as any).meetingLink}
                        />
                      )}
                      <DetailRow
                        icon={User}
                        label="Interviewer"
                        value={
                          interview.interviewer
                            ? `${interview.interviewer.firstName} ${interview.interviewer.lastName}`
                            : "Unassigned"
                        }
                      />
                      {interview.application?.job && (
                        <DetailRow
                          icon={Briefcase}
                          label="Job Role"
                          value={interview.application.job.title}
                        />
                      )}
                    </div>
                  </section>

                  {(interview as any).notes && (
                    <section className="space-y-2">
                      <h3 className="text-[10px] text-white/30 uppercase tracking-widest">
                        Notes
                      </h3>
                      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                        <p className="text-sm text-white/60 leading-relaxed">
                          {(interview as any).notes}
                        </p>
                      </div>
                    </section>
                  )}

                  {(interview as any).feedback && (
                    <section className="space-y-2">
                      <h3 className="text-[10px] text-white/30 uppercase tracking-widest">
                        Feedback
                      </h3>
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                        <p className="text-sm text-white/70 leading-relaxed">
                          {(interview as any).feedback}
                        </p>
                      </div>
                    </section>
                  )}

                  {["COMPLETED", "SCHEDULED"].includes(interview.status) && (
                    <section className="space-y-2">
                      <h3 className="text-[10px] text-white/30 uppercase tracking-widest flex items-center gap-1.5">
                        <FileText size={10} /> Add Feedback
                      </h3>
                      <FeedbackForm interviewId={interview.id} />
                    </section>
                  )}
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}