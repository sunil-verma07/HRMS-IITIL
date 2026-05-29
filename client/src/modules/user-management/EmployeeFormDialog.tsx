import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Search, X, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/input";
import {
  employeeFormSchema,
  type EmployeeFormValues,
} from "@/schemas/employee.schemas";
import { resourceApi } from "@/services/api/resource.api";
import { endpoints } from "@/services/api/endpoints";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { httpClient } from "@/services/api/http-client";

export type EmployeeFormRecord = Partial<EmployeeFormValues> & {
  id?: string;
};

type EmployeeFormDialogProps = {
  open: boolean;
  employee?: EmployeeFormRecord | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: EmployeeFormValues) => void;
};

const defaultValues: EmployeeFormValues = {
  employeeId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  designation: "",
  department: "",
  joiningDate: new Date().toISOString().slice(0, 10),
  employmentType: "FULL_TIME",
  status: "ACTIVE",
};

type SearchableDropdownProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  error?: string;
  allowCustom?: boolean;
};

function SearchableDropdown({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  allowCustom = true,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 200);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(debouncedSearch.toLowerCase()),
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (opt: string) => {
      onChange(opt);
      setOpen(false);
      setSearch("");
      setFocusedIndex(-1);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "Enter" || e.key === "ArrowDown") {
          setOpen(true);
          setFocusedIndex(0);
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (focusedIndex >= 0 && filtered[focusedIndex]) {
          handleSelect(filtered[focusedIndex]!);
        } else if (allowCustom && search.trim()) {
          handleSelect(search.trim());
        }
      } else if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    },
    [open, filtered, focusedIndex, search, allowCustom, handleSelect],
  );

  return (
    <div ref={containerRef} className="grid gap-2 text-sm relative">
      <span className="font-medium text-foreground">{label}</span>
      <div
        className={cn(
          "h-10 w-full rounded-lg border border-input bg-slate-950/55 px-3 flex items-center justify-between cursor-pointer transition-colors",
          open && "border-primary/50 ring-2 ring-primary/20",
          error && "border-rose-400/60",
        )}
        onClick={() => {
          setOpen((o) => !o);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="combobox"
        aria-expanded={open}
      >
        <span
          className={cn("text-sm truncate", !value && "text-muted-foreground")}
        >
          {value || placeholder || `Select ${label.toLowerCase()}...`}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              type="button"
              className="p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            >
              <X className="size-3" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "size-3 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-border bg-slate-900/95 backdrop-blur shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setFocusedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent text-sm pl-7 pr-2 py-1.5 outline-none placeholder:text-muted-foreground"
                placeholder="Search..."
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                {allowCustom && search.trim() ? (
                  <button
                    type="button"
                    className="text-cyan-300 hover:underline"
                    onClick={() => handleSelect(search.trim())}
                  >
                    Add "{search.trim()}"
                  </button>
                ) : (
                  "No results"
                )}
              </div>
            ) : (
              filtered.map((opt, i) => (
                <button
                  key={opt}
                  type="button"
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-white/8",
                    value === opt && "bg-primary/15 text-cyan-200",
                    focusedIndex === i && "bg-white/8",
                  )}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setFocusedIndex(i)}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {error && <span className="text-xs text-rose-300">{error}</span>}
    </div>
  );
}

type ManagerOption = {
  id: string;
  firstName: string;
  lastName: string;
  designation: string;
  department: string;
};

type ManagerDropdownProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  excludeId?: string;
};

function ManagerDropdown({
  label,
  value,
  onChange,
  error,
  excludeId,
}: ManagerDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const { data } = useQuery({
    queryKey: ["employee-options", debouncedSearch],
    queryFn: () =>
      resourceApi.list<ManagerOption>(endpoints.userManagement.users, {
        page: 1,
        limit: 50,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        filters: { role: "TEAM_LEAD" },
      }),
    enabled: open,
    staleTime: 30_000,
  });

  const managers = (data?.items ?? []).filter((m) => m.id !== excludeId);

  const selectedManager = managers.find((m) => m.id === value);
  const displayValue = selectedManager
    ? `${selectedManager.firstName} ${selectedManager.lastName}`
    : value
      ? value
      : "";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
      setSearch("");
      setFocusedIndex(-1);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "Enter" || e.key === "ArrowDown") {
          setOpen(true);
          setFocusedIndex(0);
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, managers.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (focusedIndex >= 0 && managers[focusedIndex])
          handleSelect(managers[focusedIndex]!.id);
      } else if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    },
    [open, managers, focusedIndex, handleSelect],
  );

  return (
    <div ref={containerRef} className="grid gap-2 text-sm relative">
      <span className="font-medium text-foreground">{label}</span>
      <div
        className={cn(
          "h-10 w-full rounded-lg border border-input bg-slate-950/55 px-3 flex items-center justify-between cursor-pointer transition-colors",
          open && "border-primary/50 ring-2 ring-primary/20",
          error && "border-rose-400/60",
        )}
        onClick={() => {
          setOpen((o) => !o);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="combobox"
        aria-expanded={open}
      >
        <span
          className={cn(
            "text-sm truncate",
            !displayValue && "text-muted-foreground",
          )}
        >
          {displayValue || "Select reporting manager..."}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              type="button"
              className="p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            >
              <X className="size-3" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "size-3 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-border bg-slate-900/95 backdrop-blur shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setFocusedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent text-sm pl-7 pr-2 py-1.5 outline-none placeholder:text-muted-foreground"
                placeholder="Search employees..."
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {managers.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No employees found
              </div>
            ) : (
              managers.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-white/8",
                    value === m.id && "bg-primary/15 text-cyan-200",
                    focusedIndex === i && "bg-white/8",
                  )}
                  onClick={() => handleSelect(m.id)}
                  onMouseEnter={() => setFocusedIndex(i)}
                >
                  <div className="font-medium">
                    {m.firstName} {m.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.designation} · {m.department}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {error && <span className="text-xs text-rose-300">{error}</span>}
    </div>
  );
}

export function EmployeeFormDialog({
  open,
  employee,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: EmployeeFormDialogProps) {
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues,
  });

  const { data: deptConfig } = useQuery({
    queryKey: ["config", "hr.departments"],
    queryFn: async () => {
      const res = await httpClient.get<{ data: { value: string[] } }>(
        endpoints.config.byKey("hr.departments"),
      );
      return res.data.data.value ?? [];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const { data: desigConfig } = useQuery({
    queryKey: ["config", "hr.designations"],
    queryFn: async () => {
      const res = await httpClient.get<{ data: { value: string[] } }>(
        endpoints.config.byKey("hr.designations"),
      );
      return res.data.data.value ?? [];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const departments: string[] = deptConfig ?? [];
  const designations: string[] = desigConfig ?? [];

  useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      return;
    }
    if (employee) {
      form.reset({
        ...defaultValues,
        ...employee,
        employeeId: employee.id ? (employee.employeeId ?? "") : "",
        joiningDate: employee.joiningDate
          ? String(employee.joiningDate).slice(0, 10)
          : defaultValues.joiningDate,
      });
    }
  }, [employee, form, open]);

  const watchedDesignation = form.watch("designation");
  const watchedDepartment = form.watch("department");
  const watchedReportingManagerId = form.watch(
    "reportingManagerId" as keyof EmployeeFormValues,
  ) as string | undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isSubmitting && onOpenChange(next)}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {employee?.id ? "Edit employee" : "Create employee"}
          </DialogTitle>
          <DialogDescription>
            {employee?.id
              ? "Update employee details. Employee ID is auto-managed."
              : "Employee ID will be auto-generated. Visibility policy is enforced by the API."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Work email"
              name="email"
              register={form.register}
              error={form.formState.errors.email?.message}
            />
            <FormField
              label="First name"
              name="firstName"
              register={form.register}
              error={form.formState.errors.firstName?.message}
            />
            <FormField
              label="Last name"
              name="lastName"
              register={form.register}
              error={form.formState.errors.lastName?.message}
            />
            <FormField
              label="Phone"
              name="phone"
              register={form.register}
              error={form.formState.errors.phone?.message}
            />

            <SearchableDropdown
              label="Designation"
              value={watchedDesignation}
              onChange={(v) =>
                form.setValue("designation", v, { shouldValidate: true })
              }
              options={designations}
              placeholder="e.g. Software Engineer"
              error={form.formState.errors.designation?.message}
            />

            <SearchableDropdown
              label="Department"
              value={watchedDepartment}
              onChange={(v) =>
                form.setValue("department", v, { shouldValidate: true })
              }
              options={departments}
              placeholder="e.g. Engineering"
              error={form.formState.errors.department?.message}
            />

            <FormField
              label="Joining date"
              name="joiningDate"
              type="date"
              register={form.register}
              error={form.formState.errors.joiningDate?.message}
            />

            <ManagerDropdown
              label="Reporting Manager"
              value={watchedReportingManagerId ?? ""}
              onChange={(v) =>
                form.setValue(
                  "reportingManagerId" as keyof EmployeeFormValues,
                  v as never,
                  { shouldValidate: true },
                )
              }
              excludeId={employee?.id}
            />

            <label className="grid gap-2 text-sm">
              <span className="font-medium text-foreground">
                Employment type
              </span>
              <select
                className="h-10 cursor-pointer rounded-lg border border-input bg-slate-950/55 px-3 text-sm"
                {...form.register("employmentType")}
              >
                {[
                  "FULL_TIME",
                  "PART_TIME",
                  "CONTRACT",
                  "INTERN",
                  "CONSULTANT",
                ].map((item) => (
                  <option key={item} value={item}>
                    {item.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm">
              <span className="font-medium text-foreground">Status</span>
              <select
                className="h-10 cursor-pointer rounded-lg border border-input bg-slate-950/55 px-3 text-sm"
                {...form.register("status")}
              >
                {["ACTIVE", "INACTIVE", "ON_NOTICE", "TERMINATED"].map(
                  (item) => (
                    <option key={item} value={item}>
                      {item.replace("_", " ")}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {employee?.id ? "Update employee" : "Create employee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
