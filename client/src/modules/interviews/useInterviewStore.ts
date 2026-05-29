import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { InterviewRecord } from "@/modules/recruitment/recruitment-columns";

export type CalendarView = "week" | "day";
export type PageView = "table" | "calendar";

export type InterviewFilters = {
  status: string[];
  mode: string[];
  department: string[];
  interviewerId: string;
  candidateSearch: string;
  jobSearch: string;
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_FILTERS: InterviewFilters = {
  status: [],
  mode: [],
  department: [],
  interviewerId: "",
  candidateSearch: "",
  jobSearch: "",
  dateFrom: "",
  dateTo: "",
};

type ModalMode = "create" | "edit" | "reschedule";

type InterviewStore = {
  pageView: PageView;
  calendarView: CalendarView;
  calendarDate: Date;

  filters: InterviewFilters;
  filtersOpen: boolean;
  activeFilterCount: number;

  modalOpen: boolean;
  modalMode: ModalMode;
  modalPrefill: Partial<{ date: string; time: string; applicationId: string }>;
  editingInterview: InterviewRecord | null;

  drawerOpen: boolean;
  drawerInterview: InterviewRecord | null;

  setPageView: (v: PageView) => void;
  setCalendarView: (v: CalendarView) => void;
  setCalendarDate: (d: Date) => void;

  setFilters: (f: Partial<InterviewFilters>) => void;
  clearFilters: () => void;
  setFiltersOpen: (open: boolean) => void;

  openCreateModal: (prefill?: InterviewStore["modalPrefill"]) => void;
  openEditModal: (interview: InterviewRecord) => void;
  openRescheduleModal: (interview: InterviewRecord) => void;
  closeModal: () => void;

  openDrawer: (interview: InterviewRecord) => void;
  closeDrawer: () => void;
};

function countActiveFilters(f: InterviewFilters): number {
  return (
    f.status.length +
    f.mode.length +
    f.department.length +
    (f.interviewerId ? 1 : 0) +
    (f.candidateSearch ? 1 : 0) +
    (f.jobSearch ? 1 : 0) +
    (f.dateFrom || f.dateTo ? 1 : 0)
  );
}

export const useInterviewStore = create<InterviewStore>()(
  devtools(
    (set) => ({
      pageView: "table",
      calendarView: "week",
      calendarDate: new Date(),

      filters: DEFAULT_FILTERS,
      filtersOpen: false,
      activeFilterCount: 0,

      modalOpen: false,
      modalMode: "create",
      modalPrefill: {},
      editingInterview: null,

      drawerOpen: false,
      drawerInterview: null,

      setPageView: (pageView) => set({ pageView }),
      setCalendarView: (calendarView) => set({ calendarView }),
      setCalendarDate: (calendarDate) => set({ calendarDate }),

      setFilters: (partial) =>
        set((s) => {
          const next = { ...s.filters, ...partial };
          return { filters: next, activeFilterCount: countActiveFilters(next) };
        }),
      clearFilters: () =>
        set({ filters: DEFAULT_FILTERS, activeFilterCount: 0 }),
      setFiltersOpen: (filtersOpen) => set({ filtersOpen }),

      openCreateModal: (prefill = {}) =>
        set({
          modalOpen: true,
          modalMode: "create",
          modalPrefill: prefill,
          editingInterview: null,
        }),
      openEditModal: (interview) =>
        set({
          modalOpen: true,
          modalMode: "edit",
          editingInterview: interview,
          modalPrefill: {},
        }),
      openRescheduleModal: (interview) =>
        set({
          modalOpen: true,
          modalMode: "reschedule",
          editingInterview: interview,
          modalPrefill: {},
        }),
      closeModal: () =>
        set({ modalOpen: false, editingInterview: null, modalPrefill: {} }),

      openDrawer: (interview) =>
        set({ drawerOpen: true, drawerInterview: interview }),
      closeDrawer: () => set({ drawerOpen: false, drawerInterview: null }),
    }),
    { name: "InterviewStore" },
  ),
);