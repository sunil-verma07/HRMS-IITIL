// src/modules/recruitment/ScheduleInterviewModal.tsx
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isBefore, startOfToday } from "date-fns";
import {
  X,
  Video,
  Phone,
  Monitor,
  Users,
  Loader2,
  Search,
  UserPlus,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useInterviewStore } from "./useInterviewStore";
import {
  useCreateInterview,
  useUpdateInterview,
  useCandidates,
  useCandidateApplications,
  useInterviewers,
  useJobs,
  useQuickCreateCandidateAndApplication,
} from "./useInterviews";
import { useDebounce } from "@/hooks/use-debounce";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MODES = [
  { value: "Google Meet", icon: Video, color: "text-emerald-400" },
  { value: "Zoom", icon: Video, color: "text-blue-400" },
  { value: "Teams", icon: Users, color: "text-violet-400" },
  { value: "Phone Call", icon: Phone, color: "text-amber-400" },
  { value: "Offline", icon: Monitor, color: "text-white/60" },
] as const;

const DURATIONS = [15, 30, 45, 60, 90, 120] as const;

const SOURCES = [
  { value: "EMAIL", label: "Email" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "REFERRAL", label: "Referral" },
  { value: "AGENCY", label: "Agency" },
  { value: "OTHER", label: "Other" },
] as const;

type ApplicationSource = (typeof SOURCES)[number]["value"];

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────

const interviewSchema = z
  .object({
    candidateId: z.string().min(1, "Select a candidate"),
    applicationId: z.string().min(1, "Select a job application"),
    interviewerId: z.string().min(1, "Select an interviewer"),
    date: z.string().min(1, "Date is required"),
    time: z.string().min(1, "Time is required"),
    durationMins: z.coerce.number().min(15).max(480),
    mode: z.string().min(1, "Select a meeting mode"),
    meetingLink: z.string().url("Enter a valid URL").or(z.literal("")),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (d) => !isBefore(new Date(`${d.date}T${d.time}`), new Date()),
    { message: "Cannot schedule in the past", path: ["date"] },
  );

const quickAddSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(80).trim(),
  lastName: z.string().min(1, "Last name is required").max(80).trim(),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .toLowerCase(),
  phone: z
    .string()
    .max(30)
    .regex(/^[+\d\s\-().]*$/, "Enter a valid phone number")
    .or(z.literal(""))
    .optional(),
  jobId: z.string().min(1, "Select a job"),
  source: z.enum(
    SOURCES.map((s) => s.value) as [ApplicationSource, ...ApplicationSource[]],
  ),
  resumeUrl: z
    .string()
    .url("Enter a valid resume URL")
    .or(z.literal(""))
    .optional(),
  notes: z.string().max(500).optional(),
});

type InterviewFormValues = z.infer<typeof interviewSchema>;
type QuickAddFormValues = z.infer<typeof quickAddSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Motion variants
// ─────────────────────────────────────────────────────────────────────────────

const backdrop = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
  exit: { opacity: 0 },
};

const panel = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const },
  },
  exit: { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.15 } },
};

const slideIn = {
  hidden: { opacity: 0, x: 20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.12 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface BannerProps {
  type: "info" | "warning" | "success";
  message: string;
}

function Banner({ type, message }: BannerProps) {
  const styles = {
    info: {
      wrapper: "border-blue-500/20 bg-blue-500/8 text-blue-300",
      icon: <Info size={13} className="shrink-0 mt-px" />,
    },
    warning: {
      wrapper: "border-amber-500/20 bg-amber-500/8 text-amber-300",
      icon: <AlertTriangle size={13} className="shrink-0 mt-px" />,
    },
    success: {
      wrapper: "border-emerald-500/20 bg-emerald-500/8 text-emerald-300",
      icon: <CheckCircle2 size={13} className="shrink-0 mt-px" />,
    },
  }[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
        styles.wrapper,
      )}
    >
      {styles.icon}
      <span>{message}</span>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick-Add sub-form (step 1 of the off-platform flow)
// ─────────────────────────────────────────────────────────────────────────────

interface QuickAddFormProps {
  onSuccess: (candidateId: string, applicationId: string, wasExisting: boolean) => void;
  onBack: () => void;
}

function QuickAddForm({ onSuccess, onBack }: QuickAddFormProps) {
  const quickCreateMutation = useQuickCreateCandidateAndApplication();
  const { data: jobs, isLoading: loadingJobs } = useJobs();
  const [jobSearch, setJobSearch] = useState("");
  const debouncedJobSearch = useDebounce(jobSearch, 200);

  const filteredJobs = jobs?.filter(
    (j) =>
      !debouncedJobSearch ||
      j.title.toLowerCase().includes(debouncedJobSearch.toLowerCase()) ||
      j.department?.toLowerCase().includes(debouncedJobSearch.toLowerCase()),
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<QuickAddFormValues>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      jobId: "",
      source: "EMAIL",
      resumeUrl: "",
      notes: "",
    },
  });

  const onSubmit = async (values: QuickAddFormValues) => {
    const result = await quickCreateMutation.mutateAsync({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      ...(values.phone ? { phone: values.phone } : {}),
      jobId: values.jobId,
      source: values.source,
      ...(values.resumeUrl ? { resumeUrl: values.resumeUrl } : {}),
      ...(values.notes ? { notes: values.notes } : {}),
    });

    onSuccess(
      result.candidate.id,
      result.application.id,
      result.action === "existing",
    );
  };

  const busy = isSubmitting || quickCreateMutation.isPending;

  return (
    <motion.div
      key="quick-add"
      variants={slideIn}
      initial="hidden"
      animate="show"
      exit="exit"
      className="space-y-4"
    >
      {/* Back link */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
      >
        <ArrowLeft size={12} />
        Back to candidate search
      </button>

      <Banner
        type="info"
        message="Fill in the candidate's details. If they already exist in the system we'll reuse their record automatically."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-white/50">
              First name <span className="text-rose-400">*</span>
            </label>
            <Input
              placeholder="Jane"
              {...register("firstName")}
              autoFocus
              className="h-9 border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/25"
            />
            {errors.firstName && (
              <p className="text-xs text-rose-400">{errors.firstName.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-white/50">
              Last name <span className="text-rose-400">*</span>
            </label>
            <Input
              placeholder="Doe"
              {...register("lastName")}
              className="h-9 border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/25"
            />
            {errors.lastName && (
              <p className="text-xs text-rose-400">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/50">
            Email <span className="text-rose-400">*</span>
          </label>
          <Input
            type="email"
            placeholder="jane@example.com"
            {...register("email")}
            className="h-9 border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/25"
          />
          {errors.email && (
            <p className="text-xs text-rose-400">{errors.email.message}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/50">
            Phone{" "}
            <span className="text-white/25">(optional)</span>
          </label>
          <Input
            type="tel"
            placeholder="+1 555 000 0000"
            {...register("phone")}
            className="h-9 border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/25"
          />
          {errors.phone && (
            <p className="text-xs text-rose-400">{errors.phone.message}</p>
          )}
        </div>

        {/* Source */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/50">
            Application source <span className="text-rose-400">*</span>
          </label>
          <Controller
            name="source"
            control={control}
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {SOURCES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => field.onChange(s.value)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
                      field.value === s.value
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                        : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          />
        </div>

        {/* Job selector */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/50">
            Applied for <span className="text-rose-400">*</span>
          </label>
          <div className="relative mb-1.5">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />
            <Input
              placeholder="Filter jobs…"
              value={jobSearch}
              onChange={(e) => setJobSearch(e.target.value)}
              className="pl-8 h-9 border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/25"
            />
          </div>
          <Controller
            name="jobId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-9 border-white/10 bg-white/[0.03] text-white/70 text-sm">
                  <SelectValue
                    placeholder={
                      loadingJobs ? "Loading jobs…" : "Select a job posting"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredJobs?.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-white/30">
                      No matching jobs
                    </div>
                  ) : (
                    filteredJobs?.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title}
                        <span className="ml-2 text-white/40 text-xs">
                          {j.department}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          />
          {errors.jobId && (
            <p className="text-xs text-rose-400">{errors.jobId.message}</p>
          )}
        </div>

        {/* Resume URL */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/50">
            Resume URL{" "}
            <span className="text-white/25">(optional)</span>
          </label>
          <Input
            placeholder="https://drive.google.com/…"
            {...register("resumeUrl")}
            className="h-9 border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/25"
          />
          {errors.resumeUrl && (
            <p className="text-xs text-rose-400">{errors.resumeUrl.message}</p>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/50">
            Notes{" "}
            <span className="text-white/25">(optional)</span>
          </label>
          <Textarea
            placeholder="e.g. Referred by John Smith, strong LinkedIn profile…"
            rows={2}
            {...register("notes")}
            className="border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/25 resize-none"
          />
          {errors.notes && (
            <p className="text-xs text-rose-400">{errors.notes.message}</p>
          )}
        </div>

        {quickCreateMutation.isError && (
          <Banner
            type="warning"
            message={
              (quickCreateMutation.error as any)?.message ??
              "Failed to create candidate. Please try again."
            }
          />
        )}

        <Button
          type="submit"
          size="sm"
          disabled={busy}
          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
        >
          {busy ? (
            <Loader2 size={13} className="animate-spin mr-2" />
          ) : (
            <UserPlus size={13} className="mr-2" />
          )}
          Create candidate & continue →
        </Button>
      </form>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────────────────

export function ScheduleInterviewModal() {
  const { modalOpen, modalMode, editingInterview, modalPrefill, closeModal } =
    useInterviewStore();

  const createMutation = useCreateInterview();
  const updateMutation = useUpdateInterview();

  // ── Search state ───────────────────────────────────────────────────────────
  const [candidateSearch, setCandidateSearch] = useState("");
  const [interviewerSearch, setInterviewerSearch] = useState("");
  const debouncedCandidateSearch = useDebounce(candidateSearch, 300);
  const debouncedInterviewerSearch = useDebounce(interviewerSearch, 300);

  // ── Quick-add state ────────────────────────────────────────────────────────
  // "idle"     → show standard candidate search
  // "form"     → show the quick-add inline form
  // "injected" → quick-add succeeded; show a success banner and continue with
  //              the created IDs already injected into the interview form
  const [quickAddState, setQuickAddState] = useState<
    "idle" | "form" | "injected"
  >("idle");
  const [quickAddWasExisting, setQuickAddWasExisting] = useState(false);

  // ── Remote data ────────────────────────────────────────────────────────────
  const { data: candidates, isFetching: fetchingCandidates } = useCandidates(
    debouncedCandidateSearch,
  );
  const { data: interviewers } = useInterviewers(debouncedInterviewerSearch);

  // ── Interview form ─────────────────────────────────────────────────────────
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InterviewFormValues>({
    resolver: zodResolver(interviewSchema),
    defaultValues: buildDefaults(null, null),
  });

  const selectedCandidateId = watch("candidateId");
  const selectedMode = watch("mode");

  const { data: applications, isFetching: fetchingApplications } =
    useCandidateApplications(selectedCandidateId || null);

  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!modalOpen) return;

    setQuickAddState("idle");
    setQuickAddWasExisting(false);
    setCandidateSearch("");
    setInterviewerSearch("");

    if (modalMode === "edit" && editingInterview) {
      const dt = new Date(editingInterview.scheduledAt);
      reset({
        candidateId: "",
        applicationId: (editingInterview as any).applicationId ?? "",
        interviewerId: ((editingInterview as { interviewerId?: string }).interviewerId ?? ""),
        date: format(dt, "yyyy-MM-dd"),
        time: format(dt, "HH:mm"),
        durationMins: (editingInterview as any).durationMins ?? 60,
        mode: editingInterview.mode,
        meetingLink: (editingInterview as any).meetingLink ?? "",
        notes: (editingInterview as any).notes ?? "",
      });
    } else {
      reset(buildDefaults(modalPrefill, null));
    }
  }, [modalOpen, modalMode, editingInterview, modalPrefill, reset]);

  // Clear application when candidate changes (only in non-injected state)
  useEffect(() => {
    if (quickAddState !== "injected") {
      setValue("applicationId", "");
    }
  }, [selectedCandidateId, setValue, quickAddState]);

  // ── Quick-add success callback ─────────────────────────────────────────────
  const handleQuickAddSuccess = useCallback(
    (candidateId: string, applicationId: string, wasExisting: boolean) => {
      setValue("candidateId", candidateId, { shouldValidate: true });
      setValue("applicationId", applicationId, { shouldValidate: true });
      setQuickAddWasExisting(wasExisting);
      setQuickAddState("injected");
    },
    [setValue],
  );

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = useCallback(
    async (values: InterviewFormValues) => {
      const scheduledAt = new Date(
        `${values.date}T${values.time}`,
      ).toISOString();

      if (modalMode === "create" || modalMode === "reschedule") {
        await createMutation.mutateAsync({
          applicationId: values.applicationId,
          interviewerId: values.interviewerId,
          scheduledAt,
          durationMins: values.durationMins,
          mode: values.mode,
          ...(values.meetingLink ? { meetingLink: values.meetingLink } : {}),
          ...(values.notes ? { notes: values.notes } : {}),
        });
      } else if (modalMode === "edit" && editingInterview) {
        await updateMutation.mutateAsync({
          id: editingInterview.id,
          payload: {
            scheduledAt,
            durationMins: values.durationMins,
            mode: values.mode,
            ...(values.meetingLink ? { meetingLink: values.meetingLink } : {}),
            ...(values.notes ? { notes: values.notes } : {}),
          },
        });
      }

      closeModal();
    },
    [modalMode, editingInterview, createMutation, updateMutation, closeModal],
  );

  // ── Derived ────────────────────────────────────────────────────────────────
  const title =
    modalMode === "edit"
      ? "Edit Interview"
      : modalMode === "reschedule"
        ? "Reschedule Interview"
        : "Schedule Interview";

  const busy =
    isSubmitting || createMutation.isPending || updateMutation.isPending;

  const needsMeetingLink = ["Google Meet", "Zoom", "Teams"].includes(
    selectedMode,
  );

  const showCandidateSection =
    modalMode === "create" || modalMode === "reschedule";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {modalOpen && (
        <motion.div
          variants={backdrop}
          initial="hidden"
          animate="show"
          exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <motion.div
            variants={panel}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d0f] shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#0d0d0f]">
              <div>
                <h2 className="text-sm font-semibold text-white">{title}</h2>
                <p className="text-xs text-white/40 mt-0.5">
                  {quickAddState === "form"
                    ? "Enter details for the off-platform candidate"
                    : "Fill in details to schedule a candidate interview"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-white/40 hover:text-white hover:bg-white/8 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <AnimatePresence mode="wait">
                {/* ── Quick-add form ─────────────────────────────────────────── */}
                {showCandidateSection && quickAddState === "form" ? (
                  <QuickAddForm
                    key="quick-add-form"
                    onSuccess={handleQuickAddSuccess}
                    onBack={() => setQuickAddState("idle")}
                  />
                ) : (
                  <motion.div
                    key="main-form"
                    variants={slideIn}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                  >
                    <form
                      onSubmit={handleSubmit(onSubmit)}
                      className="space-y-5"
                    >
                      {/* ── Candidate + Application section ─────────────────── */}
                      {showCandidateSection && (
                        <>
                          {quickAddState === "injected" ? (
                            /* ── Post quick-add: confirmation state ─────────── */
                            <div className="space-y-3">
                              <Banner
                                type={quickAddWasExisting ? "warning" : "success"}
                                message={
                                  quickAddWasExisting
                                    ? "Candidate already existed in the system — we've reused their record and linked the application."
                                    : "Candidate and application created successfully. Continue to fill in interview details."
                                }
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickAddState("idle");
                                  setValue("candidateId", "");
                                  setValue("applicationId", "");
                                  setCandidateSearch("");
                                }}
                                className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors"
                              >
                                ← Choose a different candidate instead
                              </button>
                            </div>
                          ) : (
                            /* ── Standard candidate search ──────────────────── */
                            <div className="space-y-4">
                              {/* Toggle row */}
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-white/60">
                                  Candidate
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setQuickAddState("form")}
                                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                                >
                                  <UserPlus size={12} />
                                  Applied via email / LinkedIn?
                                </button>
                              </div>

                              {/* Candidate search input */}
                              <div className="space-y-1.5">
                                <label className="text-xs text-white/50">
                                  Search candidate{" "}
                                  <span className="text-rose-400">*</span>
                                </label>
                                <div className="relative">
                                  <Search
                                    size={14}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                                  />
                                  <Input
                                    placeholder="Type name or email…"
                                    value={candidateSearch}
                                    onChange={(e) =>
                                      setCandidateSearch(e.target.value)
                                    }
                                    className="pl-8 h-9 border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/25"
                                  />
                                  {fetchingCandidates && (
                                    <Loader2
                                      size={12}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 animate-spin"
                                    />
                                  )}
                                </div>
                                <Controller
                                  name="candidateId"
                                  control={control}
                                  render={({ field }) => (
                                    <Select
                                      value={field.value}
                                      onValueChange={field.onChange}
                                      disabled={
                                        !candidates || candidates.length === 0
                                      }
                                    >
                                      <SelectTrigger className="h-9 border-white/10 bg-white/[0.03] text-white/70 text-sm">
                                        <SelectValue
                                          placeholder={
                                            debouncedCandidateSearch.length < 1
                                              ? "Search above to find candidates"
                                              : fetchingCandidates
                                                ? "Searching…"
                                                : candidates?.length === 0
                                                  ? "No candidates found — use the link above to add"
                                                  : "Select a candidate"
                                          }
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {candidates?.map((c) => (
                                          <SelectItem key={c.id} value={c.id}>
                                            {c.firstName} {c.lastName}
                                            <span className="ml-2 text-white/40 text-xs">
                                              {c.email}
                                            </span>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                                {errors.candidateId && (
                                  <p className="text-xs text-rose-400">
                                    {errors.candidateId.message}
                                  </p>
                                )}
                              </div>

                              {/* Application selector */}
                              <div className="space-y-1.5">
                                <label className="text-xs text-white/50">
                                  Job Application{" "}
                                  <span className="text-rose-400">*</span>
                                </label>
                                <Controller
                                  name="applicationId"
                                  control={control}
                                  render={({ field }) => (
                                    <Select
                                      value={field.value}
                                      onValueChange={field.onChange}
                                      disabled={!selectedCandidateId}
                                    >
                                      <SelectTrigger className="h-9 border-white/10 bg-white/[0.03] text-white/70 text-sm">
                                        <SelectValue
                                          placeholder={
                                            !selectedCandidateId
                                              ? "Select candidate first"
                                              : fetchingApplications
                                                ? "Loading applications…"
                                                : applications?.length === 0
                                                  ? "No active applications found"
                                                  : "Select application"
                                          }
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {applications?.map((a) => (
                                          <SelectItem key={a.id} value={a.id}>
                                            {a.job.title}
                                            <span className="ml-2 text-white/40 text-xs">
                                              {a.job.department} · {a.stage}
                                            </span>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                                {errors.applicationId && (
                                  <p className="text-xs text-rose-400">
                                    {errors.applicationId.message}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* ── Interviewer ──────────────────────────────────────── */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-white/50">
                          Interviewer{" "}
                          <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative mb-1.5">
                          <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                          />
                          <Input
                            placeholder="Search interviewer…"
                            value={interviewerSearch}
                            onChange={(e) =>
                              setInterviewerSearch(e.target.value)
                            }
                            className="pl-8 h-9 border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/25"
                          />
                        </div>
                        <Controller
                          name="interviewerId"
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="h-9 border-white/10 bg-white/[0.03] text-white/70 text-sm">
                                <SelectValue placeholder="Select interviewer" />
                              </SelectTrigger>
                              <SelectContent>
                                {interviewers?.map((e) => (
                                  <SelectItem key={e.id} value={e.id}>
                                    {e.firstName} {e.lastName}
                                    <span className="ml-2 text-white/40 text-xs">
                                      {e.designation}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.interviewerId && (
                          <p className="text-xs text-rose-400">
                            {errors.interviewerId.message}
                          </p>
                        )}
                      </div>

                      {/* ── Date + Time ──────────────────────────────────────── */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs text-white/50">
                            Date <span className="text-rose-400">*</span>
                          </label>
                          <Input
                            type="date"
                            min={format(startOfToday(), "yyyy-MM-dd")}
                            {...register("date")}
                            className="h-9 border-white/10 bg-white/[0.03] text-white/80 text-sm"
                          />
                          {errors.date && (
                            <p className="text-xs text-rose-400">
                              {errors.date.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-white/50">
                            Time <span className="text-rose-400">*</span>
                          </label>
                          <Input
                            type="time"
                            {...register("time")}
                            className="h-9 border-white/10 bg-white/[0.03] text-white/80 text-sm"
                          />
                          {errors.time && (
                            <p className="text-xs text-rose-400">
                              {errors.time.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* ── Duration ─────────────────────────────────────────── */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-white/50">Duration</label>
                        <div className="flex gap-2 flex-wrap">
                          {DURATIONS.map((d) => (
                            <Controller
                              key={d}
                              name="durationMins"
                              control={control}
                              render={({ field }) => (
                                <button
                                  type="button"
                                  onClick={() => field.onChange(d)}
                                  className={cn(
                                    "rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
                                    field.value === d
                                      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                                      : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60",
                                  )}
                                >
                                  {d < 60 ? `${d}m` : `${d / 60}h`}
                                </button>
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      {/* ── Meeting Mode ─────────────────────────────────────── */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-white/50">
                          Meeting Mode{" "}
                          <span className="text-rose-400">*</span>
                        </label>
                        <Controller
                          name="mode"
                          control={control}
                          render={({ field }) => (
                            <div className="grid grid-cols-5 gap-2">
                              {MODES.map((m) => {
                                const Icon = m.icon;
                                return (
                                  <button
                                    key={m.value}
                                    type="button"
                                    onClick={() => field.onChange(m.value)}
                                    className={cn(
                                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all",
                                      field.value === m.value
                                        ? "border-cyan-500/40 bg-cyan-500/8 text-cyan-300"
                                        : "border-white/8 text-white/40 hover:border-white/15 hover:text-white/60",
                                    )}
                                  >
                                    <Icon
                                      size={16}
                                      className={
                                        field.value === m.value
                                          ? "text-cyan-400"
                                          : m.color
                                      }
                                    />
                                    <span className="text-[10px] leading-tight">
                                      {m.value}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        />
                        {errors.mode && (
                          <p className="text-xs text-rose-400">
                            {errors.mode.message}
                          </p>
                        )}
                      </div>

                      {/* ── Meeting Link (virtual only) ──────────────────────── */}
                      {needsMeetingLink && (
                        <div className="space-y-1.5">
                          <label className="text-xs text-white/50">
                            Meeting Link
                          </label>
                          <Input
                            placeholder="https://meet.google.com/…"
                            {...register("meetingLink")}
                            className="h-9 border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/25"
                          />
                          {errors.meetingLink && (
                            <p className="text-xs text-rose-400">
                              {errors.meetingLink.message}
                            </p>
                          )}
                        </div>
                      )}

                      {/* ── Notes ────────────────────────────────────────────── */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-white/50">
                          Notes{" "}
                          <span className="text-white/25">
                            (optional, max 500 chars)
                          </span>
                        </label>
                        <Textarea
                          placeholder="Additional context for the interviewer…"
                          rows={3}
                          {...register("notes")}
                          className="border-white/10 bg-white/[0.03] text-white/80 text-sm placeholder:text-white/25 resize-none"
                        />
                        {errors.notes && (
                          <p className="text-xs text-rose-400">
                            {errors.notes.message}
                          </p>
                        )}
                      </div>

                      {/* ── Submit error ─────────────────────────────────────── */}
                      {(createMutation.isError || updateMutation.isError) && (
                        <Banner
                          type="warning"
                          message={
                            ((createMutation.error ?? updateMutation.error) as any)
                              ?.message ?? "Something went wrong. Please try again."
                          }
                        />
                      )}

                      {/* ── Actions ──────────────────────────────────────────── */}
                      <div className="flex justify-end gap-3 pt-2 border-t border-white/8">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={closeModal}
                          className="text-white/50 hover:text-white"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={busy}
                          className="min-w-[120px] bg-cyan-600 hover:bg-cyan-500 text-white"
                        >
                          {busy ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            title
                          )}
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildDefaults(
  prefill: { date?: string; time?: string; applicationId?: string } | null,
  _interview: unknown,
): InterviewFormValues {
  return {
    candidateId: "",
    applicationId: prefill?.applicationId ?? "",
    interviewerId: "",
    date: prefill?.date ?? format(new Date(), "yyyy-MM-dd"),
    time: prefill?.time ?? "10:00",
    durationMins: 60,
    mode: "",
    meetingLink: "",
    notes: "",
  };
}