import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Minus, Search, Shield, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/animations/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { useDebounce } from "@/hooks/use-debounce";
import { endpoints } from "@/services/api/endpoints";
import { resourceApi } from "@/services/api/resource.api";
import { httpClient } from "@/services/api/http-client";
import type { ApiResponse } from "@/types/api";
import { cn } from "@/lib/utils";

type Permission = {
  id: string;
  code: string;
  resource: string;
  action: string;
  description?: string;
};

type RolePermissionEntry = {
  permission: Permission;
};

type Role = {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
  status: "SYSTEM" | "ACTIVE" | "INACTIVE";
  permissions: RolePermissionEntry[];
};

// Roles ordered by hierarchy for display
const ROLE_ORDER = [
  "SUPER_ADMIN",
  "PORTAL_ADMIN",
  "HR_MANAGER",
  "HR_EXECUTIVE",
  "TEAM_LEAD",
  "EMPLOYEE",
  "INTERN",
];

// Resource display config
const RESOURCE_META: Record<string, { label: string; color: string }> = {
  employee: { label: "Employee Management", color: "text-cyan-300" },
  attendance: { label: "Attendance", color: "text-green-300" },
  leave: { label: "Leaves", color: "text-yellow-300" },
  job: { label: "Recruitment", color: "text-violet-300" },
  interview: { label: "Interviews", color: "text-purple-300" },
  onboarding: { label: "Onboarding", color: "text-orange-300" },
  "offer-letter": { label: "Offer Letters", color: "text-pink-300" },
  template: { label: "Templates", color: "text-rose-300" },
  notification: { label: "Notifications", color: "text-blue-300" },
  rbac: { label: "Roles & Permissions", color: "text-red-300" },
  settings: { label: "Settings", color: "text-slate-300" },
  report: { label: "Reports", color: "text-teal-300" },
  "audit-log": { label: "Audit Logs", color: "text-indigo-300" },
  dashboard: { label: "Dashboard", color: "text-emerald-300" },
};

function resourceLabel(resource: string): string {
  return (
    RESOURCE_META[resource]?.label ??
    resource.charAt(0).toUpperCase() + resource.slice(1)
  );
}

function resourceColor(resource: string): string {
  return RESOURCE_META[resource]?.color ?? "text-foreground";
}

export function PermissionsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [expandedResources, setExpandedResources] = useState<Set<string>>(
    new Set(),
  );
  const debouncedSearch = useDebounce(search, 250);

  // Fetch all permissions
  const {
    data: permissionsData,
    isLoading: permsLoading,
    isError: permsError,
  } = useQuery({
    queryKey: ["permissions-matrix"],
    queryFn: () =>
      resourceApi.list<Permission>(endpoints.permissions, {
        page: 1,
        limit: 500,
      }),
    staleTime: 60_000,
  });

  // Fetch roles with their permissions included
  const {
    data: rolesData,
    isLoading: rolesLoading,
    isError: rolesError,
  } = useQuery({
    queryKey: ["roles-matrix"],
    queryFn: () =>
      resourceApi.list<Role>(endpoints.roles, { page: 1, limit: 100 }),
    staleTime: 60_000,
  });

  const allPermissions = permissionsData?.items ?? [];
  const allRoles = useMemo(() => {
    const roles = rolesData?.items ?? [];
    return [...roles].sort((a, b) => {
      const ai = ROLE_ORDER.indexOf(a.code);
      const bi = ROLE_ORDER.indexOf(b.code);
      if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [rolesData]);

  // Build permission set per role: roleId → Set<permissionId>
  const rolePermissionMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const role of allRoles) {
      const permIds = new Set<string>();
      for (const entry of role.permissions ?? []) {
        permIds.add(entry.permission.id);
      }
      map.set(role.id, permIds);
    }
    return map;
  }, [allRoles]);

  // Group permissions by resource
  const resourceGroups = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const groups = new Map<string, Permission[]>();

    for (const perm of allPermissions) {
      if (moduleFilter && perm.resource !== moduleFilter) continue;
      if (
        q &&
        !perm.code.toLowerCase().includes(q) &&
        !perm.action.toLowerCase().includes(q) &&
        !(perm.description?.toLowerCase().includes(q) ?? false)
      ) {
        continue;
      }
      const list = groups.get(perm.resource) ?? [];
      list.push(perm);
      groups.set(perm.resource, list);
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [allPermissions, debouncedSearch, moduleFilter]);

  const uniqueResources = useMemo(
    () => Array.from(new Set(allPermissions.map((p) => p.resource))).sort(),
    [allPermissions],
  );

  const toggleResource = useCallback((resource: string) => {
    setExpandedResources((prev) => {
      const next = new Set(prev);
      if (next.has(resource)) {
        next.delete(resource);
      } else {
        next.add(resource);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedResources(new Set(resourceGroups.map(([r]) => r)));
  }, [resourceGroups]);

  const collapseAll = useCallback(() => {
    setExpandedResources(new Set());
  }, []);

  // Mutation to toggle a single permission on a role
  const toggleMutation = useMutation({
    mutationFn: ({
      roleId,
      permissionId,
      enabled,
    }: {
      roleId: string;
      permissionId: string;
      enabled: boolean;
    }) =>
      httpClient.put<ApiResponse<void>>(
        `/rbac/roles/${roleId}/permissions/${permissionId}`,
        { enabled },
      ),
    onMutate: async ({ roleId, permissionId, enabled }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["roles-matrix"] });
      const previous = queryClient.getQueryData(["roles-matrix"]);
      queryClient.setQueryData(["roles-matrix"], (old: typeof rolesData) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((role) => {
            if (role.id !== roleId) return role;
            const perms = role.permissions ?? [];
            if (enabled) {
              const alreadyHas = perms.some(
                (e) => e.permission.id === permissionId,
              );
              if (alreadyHas) return role;
              const perm = allPermissions.find((p) => p.id === permissionId);
              if (!perm) return role;
              return { ...role, permissions: [...perms, { permission: perm }] };
            } else {
              return {
                ...role,
                permissions: perms.filter(
                  (e) => e.permission.id !== permissionId,
                ),
              };
            }
          }),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["roles-matrix"], context.previous);
      }
      toast.error("Failed to update permission");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles-matrix"] });
    },
  });

  // Grant all permissions in a resource group to a role
  const setFullAccess = useCallback(
    (roleId: string, resourcePerms: Permission[], enabled: boolean) => {
      const role = allRoles.find((r) => r.id === roleId);
      if (!role || role.code === "SUPER_ADMIN") {
        toast.info("Super Admin permissions are locked");
        return;
      }
      for (const perm of resourcePerms) {
        toggleMutation.mutate({ roleId, permissionId: perm.id, enabled });
      }
    },
    [allRoles, toggleMutation],
  );

  const isLoading = permsLoading || rolesLoading;
  const hasError = permsError || rolesError;

  if (isLoading) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <PageHeader
            eyebrow="RBAC matrix"
            title="Permission management"
            description="Loading permission matrix…"
          />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-white/[0.04]"
              />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  if (hasError) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <PageHeader
            eyebrow="RBAC matrix"
            title="Permission management"
            description="Failed to load permission data."
          />
          <SectionCard
            title="Error"
            description="Could not fetch roles or permissions from the server."
          >
            <Button
              variant="outline"
              onClick={() => {
                void queryClient.invalidateQueries({
                  queryKey: ["roles-matrix"],
                });
                void queryClient.invalidateQueries({
                  queryKey: ["permissions-matrix"],
                });
              }}
            >
              Retry
            </Button>
          </SectionCard>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="RBAC matrix"
          title="Permission management"
          description="Enterprise permission matrix. System role permissions are enforced server-side and cannot be changed here."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand all
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse all
              </Button>
            </div>
          }
        />

        {/* Filters */}
        <SectionCard
          title="Filters"
          description="Narrow the matrix by module or search term."
        >
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search permissions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-9"
              />
            </div>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">All modules</option>
              {uniqueResources.map((r) => (
                <option key={r} value={r}>
                  {resourceLabel(r)}
                </option>
              ))}
            </select>
          </div>
        </SectionCard>

        {/* Role legend */}
        <SectionCard
          title="Roles"
          description="Columns in the permission matrix below."
        >
          <div className="flex flex-wrap gap-2">
            {allRoles.map((role) => (
              <div
                key={role.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-white/[0.04] px-3 py-1.5"
              >
                <Shield className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{role.name}</span>
                {role.isSystem && (
                  <Badge variant="secondary" className="text-xs px-1 py-0">
                    SYS
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Permission matrix by resource */}
        {resourceGroups.length === 0 ? (
          <SectionCard
            title="No results"
            description="No permissions match the current filters."
          >
            <div className="rounded-xl border border-dashed border-border bg-white/[0.025] p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Try adjusting the search or module filter.
              </p>
            </div>
          </SectionCard>
        ) : (
          <div className="space-y-4">
            {resourceGroups.map(([resource, perms]) => {
              const isExpanded = expandedResources.has(resource);
              return (
                <div
                  key={resource}
                  className="rounded-xl border border-border overflow-hidden"
                >
                  {/* Resource header */}
                  <button
                    type="button"
                    onClick={() => toggleResource(resource)}
                    className="flex w-full cursor-pointer items-center justify-between border-b border-border bg-slate-900/60 px-4 py-3 hover:bg-slate-900/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Zap className={cn("size-4", resourceColor(resource))} />
                      <span
                        className={cn(
                          "font-semibold text-sm",
                          resourceColor(resource),
                        )}
                      >
                        {resourceLabel(resource)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {perms.length} permissions
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {isExpanded ? "▲ Collapse" : "▼ Expand"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-slate-950/40">
                            <th className="sticky left-0 z-10 bg-slate-950/80 px-4 py-3 text-left font-medium text-muted-foreground min-w-[220px]">
                              Permission
                            </th>
                            {allRoles.map((role) => (
                              <th
                                key={role.id}
                                className="px-3 py-3 text-center font-medium text-muted-foreground min-w-[90px]"
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <span className="truncate max-w-[80px]">
                                    {role.name}
                                  </span>
                                  {!role.isSystem && (
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        title="Grant all in module"
                                        onClick={() =>
                                          setFullAccess(role.id, perms, true)
                                        }
                                        className="cursor-pointer rounded bg-emerald-500/20 px-1 text-[10px] text-emerald-300 hover:bg-emerald-500/40 transition-colors"
                                      >
                                        All
                                      </button>
                                      <button
                                        type="button"
                                        title="Revoke all in module"
                                        onClick={() =>
                                          setFullAccess(role.id, perms, false)
                                        }
                                        className="cursor-pointer rounded bg-red-500/20 px-1 text-[10px] text-red-300 hover:bg-red-500/40 transition-colors"
                                      >
                                        None
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {perms.map((perm) => (
                            <tr
                              key={perm.id}
                              className="border-b border-border/50 last:border-0 hover:bg-white/[0.015] transition-colors"
                            >
                              <td className="sticky left-0 z-10 bg-slate-950/60 px-4 py-2.5">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-mono text-cyan-300">
                                    {perm.code}
                                  </span>
                                  {perm.description && (
                                    <span className="text-muted-foreground text-[11px] max-w-[200px] truncate">
                                      {perm.description}
                                    </span>
                                  )}
                                </div>
                              </td>
                              {allRoles.map((role) => {
                                const hasPermission =
                                  rolePermissionMap
                                    .get(role.id)
                                    ?.has(perm.id) ?? false;
                                const isSystem = role.code === "SUPER_ADMIN";
                                const isPending =
                                  toggleMutation.isPending &&
                                  toggleMutation.variables?.roleId ===
                                    role.id &&
                                  toggleMutation.variables?.permissionId ===
                                    perm.id;

                                return (
                                  <td
                                    key={role.id}
                                    className="px-3 py-2.5 text-center"
                                  >
                                    <button
                                      type="button"
                                      disabled={isSystem || isPending}
                                      onClick={() => {
                                        if (isSystem) {
                                          toast.info(
                                            "System role permissions are managed server-side",
                                          );
                                          return;
                                        }
                                        toggleMutation.mutate({
                                          roleId: role.id,
                                          permissionId: perm.id,
                                          enabled: !hasPermission,
                                        });
                                      }}
                                      className={cn(
                                        "mx-auto flex size-6 items-center justify-center rounded transition-all",
                                        isSystem
                                          ? "cursor-not-allowed opacity-40"
                                          : "cursor-pointer",
                                        hasPermission
                                          ? "bg-emerald-500/25 text-emerald-300 hover:bg-emerald-500/40"
                                          : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]",
                                        isPending && "animate-pulse",
                                      )}
                                      title={
                                        isSystem
                                          ? "System role — read only"
                                          : hasPermission
                                            ? "Revoke permission"
                                            : "Grant permission"
                                      }
                                    >
                                      {hasPermission ? (
                                        <Check className="size-3.5" />
                                      ) : isSystem ? (
                                        <Minus className="size-3" />
                                      ) : (
                                        <span className="size-2 rounded-full bg-current opacity-30" />
                                      )}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
