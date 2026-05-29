import { useState, useCallback, useDeferredValue } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, CalendarDays, TableProperties } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInterviews } from "./useInterviews";
import { useInterviewStore } from "./useInterviewStore";
import { InterviewAnalyticsCards } from "./InterviewAnalyticsCards";
import { InterviewFilters, FilterToggleButton } from "./InterviewFilters";
import { InterviewTable } from "./InterviewTable";
import { InterviewCalendarView } from "./InterviewCalendarView";
import { ScheduleInterviewModal } from "./ScheduleInterviewModal";
import { InterviewDrawer } from "./InterviewDrawer";

const PAGE_LIMIT = 20;

const VIEW_TABS = [
  { key: "table" as const, label: "Table", icon: TableProperties },
  { key: "calendar" as const, label: "Calendar", icon: CalendarDays },
] as const;

export function InterviewsPage() {
  const [page, setPage] = useState(1);
  const [searchRaw, setSearchRaw] = useState("");
  const search = useDeferredValue(searchRaw);

  const { pageView, setPageView, filters, filtersOpen, openCreateModal } =
    useInterviewStore();

  const { data, isLoading, isFetching } = useInterviews(
    page,
    PAGE_LIMIT,
    search,
    filters,
  );

  const interviews = data?.items ?? [];
  const total = data?.total ?? 0;

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchRaw(e.target.value);
      setPage(1);
    },
    [],
  );

  const handlePageChange = useCallback((p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="flex flex-col gap-5 p-5 lg:p-6 min-h-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-base font-semibold text-white/90 leading-tight">
            Interviews
          </h1>
          <p className="text-xs text-white/35 mt-0.5">
            Schedule, track, and manage all candidate interviews
          </p>
        </div>

        <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
          <Button
            size="sm"
            onClick={() => openCreateModal()}
            className="h-8 gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
          >
            <Plus size={13} />
            Schedule Interview
          </Button>
        </motion.div>
      </div>

      <InterviewAnalyticsCards />

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
          />
          <input
            type="text"
            value={searchRaw}
            onChange={handleSearch}
            placeholder="Search candidate, job, interviewer…"
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-white/10 bg-white/[0.03] text-sm text-white/70 placeholder:text-white/25 outline-none focus:border-white/20 transition-colors"
          />
          {isFetching && !isLoading && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border border-white/10 border-t-cyan-400 animate-spin" />
          )}
        </div>

        <FilterToggleButton />

        <div className="ml-auto flex rounded-lg border border-white/10 overflow-hidden">
          {VIEW_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPageView(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                pageView === key
                  ? "bg-white/8 text-white/80"
                  : "text-white/30 hover:text-white/60",
              )}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <InterviewFilters open={filtersOpen} />

      <AnimatePresence mode="wait">
        {pageView === "table" ? (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            <InterviewTable
              interviews={interviews}
              total={total}
              page={page}
              limit={PAGE_LIMIT}
              isLoading={isLoading}
              onPageChange={handlePageChange}
            />
          </motion.div>
        ) : (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            <InterviewCalendarView
              interviews={interviews}
              isLoading={isLoading}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ScheduleInterviewModal />
      <InterviewDrawer />
    </div>
  );
}
