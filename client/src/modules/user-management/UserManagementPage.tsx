import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit3, Loader2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { endpoints } from "@/services/api/endpoints";
import { employeeApi } from "@/services/api/employee.api";
import { OperationalModulePage } from "@/modules/shared/OperationalModulePage";
import type { EmployeeFormValues } from "@/schemas/employee.schemas";
import {
  EmployeeFormDialog,
  type EmployeeFormRecord,
} from "./EmployeeFormDialog";
import { useAuthStore } from '@/store/auth.store';


type UserManagementEmployee = EmployeeFormRecord & Record<string, unknown>;

export function UserManagementPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] =
    useState<UserManagementEmployee | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<UserManagementEmployee | null>(null);

  const invalidateEmployees = () => {
    void queryClient.invalidateQueries({ queryKey: ["user-management"] });
  };

  const createMutation = useMutation({
    mutationFn: employeeApi.create,
    onSuccess: () => {
      toast.success("Employee created");
      setDialogOpen(false);
      invalidateEmployees();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: EmployeeFormValues }) =>
      employeeApi.update(id, values),
    onSuccess: () => {
      toast.success("Employee updated");
      setDialogOpen(false);
      setEditingEmployee(null);
      invalidateEmployees();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: employeeApi.remove,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["user-management"] });
      const previous = queryClient.getQueriesData({
        queryKey: ["user-management"],
      });
      queryClient.setQueriesData(
        { queryKey: ["user-management"] },
        (current) => {
          if (
            !current ||
            typeof current !== "object" ||
            !("items" in current)
          ) {
            return current;
          }

          const data = current as {
            items: UserManagementEmployee[];
            meta: { total: number };
          };
          return {
            ...data,
            items: data.items.filter((item) => item.id !== id),
            meta: { ...data.meta, total: Math.max(data.meta.total - 1, 0) },
          };
        },
      );
      return { previous };
    },
    onError: (error, _id, context) => {
      context?.previous.forEach(([key, value]) =>
        queryClient.setQueryData(key, value),
      );
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Employee deleted");
      setDeleteTarget(null);
    },
    onSettled: invalidateEmployees,
  });

  const columns = useMemo<ColumnDef<UserManagementEmployee>[]>(
    () => [
      {
        accessorKey: "employeeId",
        header: "Employee ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {String(row.original.employeeId ?? "-")}
          </span>
        ),
      },
      {
        id: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {String(row.original.firstName ?? "")}{" "}
            {String(row.original.lastName ?? "")}
          </span>
        ),
      },
      { accessorKey: "department", header: "Department" },
      { accessorKey: "designation", header: "Designation" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant="success">{String(row.original.status ?? "-")}</Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const currentUser = useAuthStore((s) => s.user);
          const emp = row.original;
          const isSelf = currentUser?.employeeId === emp.id;
          const isSuperAdmin =
            (
              emp.user as { roles?: { role: { code: string } }[] } | undefined
            )?.roles?.some((r) => r.role.code === "SUPER_ADMIN") ?? false;

          if (isSelf || isSuperAdmin) return null;

          return (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingEmployee(emp);
                  setDialogOpen(true);
                }}
              >
                <Edit3 className="size-3.5" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDeleteTarget(emp)}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          );
        },
      },
    ],
    [],
  );

  const submitEmployee = (values: EmployeeFormValues) => {
    if (editingEmployee?.id) {
      updateMutation.mutate({ id: editingEmployee.id, values });
      return;
    }

    createMutation.mutate(values);
  };

  return (
    <>
      <OperationalModulePage<UserManagementEmployee>
        config={{
          resource: "user-management",
          endpoint: endpoints.userManagement.users,
          eyebrow: "Sensitive HRMS access",
          title: "User management",
          description:
            "HR/Admin-only employee operations, account controls, onboarding data, documents, attendance scope, and payroll-ready information filtered by enterprise visibility policy.",
          createLabel: "Create employee",
          columns,
          emptyTitle: "No manageable users",
          emptyDescription:
            "No users are manageable under your current role and hierarchy visibility policy.",
          onCreate: () => {
            setEditingEmployee(null);
            setDialogOpen(true);
          },
          filters: [
            { key: "status", label: "Status", value: "Active" },
            {
              key: "visibility",
              label: "Visibility",
              value: "Policy enforced",
            },
          ],
        }}
      />
      <EmployeeFormDialog
        open={dialogOpen}
        employee={editingEmployee}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingEmployee(null);
          }
        }}
        onSubmit={submitEmployee}
      />
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) =>
          !deleteMutation.isPending && !open && setDeleteTarget(null)
        }
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete employee?</DialogTitle>
            <DialogDescription>
              This soft-deletes the employee from HRMS views. Visibility rules
              still apply.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-white/[0.035] p-4 text-sm text-muted-foreground">
            {deleteTarget?.firstName} {deleteTarget?.lastName} ·{" "}
            {deleteTarget?.employeeId}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending || !deleteTarget?.id}
              onClick={() =>
                deleteTarget?.id && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
