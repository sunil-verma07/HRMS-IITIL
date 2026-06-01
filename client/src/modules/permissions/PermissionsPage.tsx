import { Fragment, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { PageTransition } from '@/components/animations/PageTransition';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { authApi } from '@/services/api/auth.api';
import { endpoints } from '@/services/api/endpoints';
import { httpClient } from '@/services/api/http-client';
import { useAuthStore } from '@/store/auth.store';
import type { ApiResponse } from '@/types/api';

type PermissionScope = 'none' | 'self' | 'team' | 'department' | 'all';
type PermissionMatrix = Record<string, Record<string, Record<string, PermissionScope>>>;

type RoleRecord = {
  id: string;
  code: string;
  name: string;
  isSystem?: boolean;
  hierarchyLevel?: number;
};

type PermissionRecord = {
  id: string;
  code: string;
  resource: string;
  action: string;
};

type MatrixModule = {
  resource: string;
  label: string;
  rows: Array<{ action: string; label: string }>;
};

const scopeOptions: Array<{ value: PermissionScope; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'self', label: 'Self' },
  { value: 'team', label: 'Team' },
  { value: 'department', label: 'Department' },
  { value: 'all', label: 'All' },
];

const changeKey = (roleCode: string, resource: string, action: string) =>
  `${roleCode}::${resource}::${action}`;

const titleCase = (value: string) =>
  value
    .replace(/[_\.:-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const roleLabel = (roleCode: string) => titleCase(roleCode);

const moduleLabel = (resource: string) => titleCase(resource);

const actionLabel = (action: string) => titleCase(action);

const fetchPermissionMatrix = async (): Promise<PermissionMatrix> => {
  const response = await httpClient.get<ApiResponse<PermissionMatrix>>(endpoints.permissionMatrix);
  return response.data.data ?? {};
};

const fetchRoles = async (): Promise<RoleRecord[]> => {
  const response = await httpClient.get<ApiResponse<RoleRecord[]>>(endpoints.roles);
  return response.data.data ?? [];
};

const fetchPermissions = async (): Promise<PermissionRecord[]> => {
  const response = await httpClient.get<ApiResponse<PermissionRecord[]>>(endpoints.permissions);
  return response.data.data ?? [];
};

const getScope = (
  matrix: PermissionMatrix,
  roleCode: string,
  resource: string,
  action: string,
): PermissionScope => matrix[roleCode]?.[resource]?.[action] ?? 'none';

export function PermissionsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [draftMatrix, setDraftMatrix] = useState<PermissionMatrix>({});
  const [pendingChanges, setPendingChanges] = useState<Record<string, PermissionScope>>({});
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(),
  );

  const {
    data: matrixData,
    isLoading: matrixLoading,
    isError: matrixError,
  } = useQuery({
    queryKey: ['permission-matrix'],
    queryFn: fetchPermissionMatrix,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const {
    data: rolesData,
    isLoading: rolesLoading,
    isError: rolesError,
  } = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: fetchRoles,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const {
    data: permissionsData,
    isLoading: permissionsLoading,
    isError: permissionsError,
  } = useQuery({
    queryKey: ['rbac-permissions'],
    queryFn: fetchPermissions,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (matrixData) {
      setDraftMatrix(matrixData);
      setPendingChanges({});
    }
  }, [matrixData]);

  const roleOrder = useMemo(
    () =>
      (rolesData ?? [])
        .filter((role) => role.code !== 'SUPER_ADMIN')
        .sort((a, b) => {
          const aLevel = a.hierarchyLevel ?? Number.MAX_SAFE_INTEGER;
          const bLevel = b.hierarchyLevel ?? Number.MAX_SAFE_INTEGER;
          if (aLevel !== bLevel) {
            return aLevel - bLevel;
          }
          return a.name.localeCompare(b.name);
        })
        .map((role) => role.code),
    [rolesData],
  );

  const matrixModules = useMemo<MatrixModule[]>(() => {
    const byResource = new Map<string, Set<string>>();

    for (const permission of permissionsData ?? []) {
      if (!permission.resource || !permission.action) {
        continue;
      }

      const actions = byResource.get(permission.resource) ?? new Set<string>();
      actions.add(permission.action);
      byResource.set(permission.resource, actions);
    }

    return [...byResource.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([resource, actions]) => ({
        resource,
        label: moduleLabel(resource),
        rows: [...actions]
          .sort((a, b) => a.localeCompare(b))
          .map((action) => ({ action, label: actionLabel(action) })),
      }));
  }, [permissionsData]);

  useEffect(() => {
    if (matrixModules.length > 0 && expandedModules.size === 0) {
      setExpandedModules(new Set(matrixModules.map((module) => module.resource)));
    }
  }, [matrixModules, expandedModules.size]);

  const filteredModules = useMemo(() => {
    const query = search.trim().toLowerCase();

    return matrixModules.filter((module) => {
      if (moduleFilter && module.resource !== moduleFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      if (module.label.toLowerCase().includes(query) || module.resource.toLowerCase().includes(query)) {
        return true;
      }

      return module.rows.some((row) => `${module.resource}:${row.action}:${row.label.toLowerCase()}`.includes(query));
    });
  }, [matrixModules, moduleFilter, search]);

  const uniqueResources = useMemo(() => matrixModules.map((module) => module.resource), [matrixModules]);
  const pendingCount = Object.keys(pendingChanges).length;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (pendingCount === 0) {
        return queryClient.getQueryData<PermissionMatrix>(['permission-matrix']) ?? draftMatrix;
      }

      const changes = Object.entries(pendingChanges).map(([key, scope]) => {
        const [roleCode, resource, action] = key.split('::');
        return { roleCode, resource, action, scope };
      });

      const response = await httpClient.put<ApiResponse<PermissionMatrix>>(endpoints.permissionMatrix, {
        changes,
      });
      return response.data.data ?? {};
    },
    onSuccess: async (nextMatrix) => {
      queryClient.setQueryData(['permission-matrix'], nextMatrix);
      await queryClient.invalidateQueries({ queryKey: ['permission-matrix'], refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: ['rbac-roles'], refetchType: 'all' });
      await queryClient.invalidateQueries({ queryKey: ['rbac-permissions'], refetchType: 'all' });
      const freshMatrix = await queryClient.fetchQuery({
        queryKey: ['permission-matrix'],
        queryFn: fetchPermissionMatrix,
      });

      setPendingChanges({});
      setDraftMatrix(freshMatrix);

      const { refreshToken, setSession } = useAuthStore.getState();
      if (refreshToken) {
        try {
          const refreshedSession = await authApi.refresh(refreshToken);
          setSession(refreshedSession);
        } catch {
          toast.warning('Permissions saved, but token refresh failed. Please re-login.');
        }
      }

      toast.success('Permission matrix updated');
    },
    onError: (error: Error) => {
      const serverMatrix = queryClient.getQueryData<PermissionMatrix>(['permission-matrix']) ?? matrixData ?? {};
      setDraftMatrix(serverMatrix);
      setPendingChanges({});
      toast.error(error.message || 'Failed to update permission matrix');
    },
  });

  const updateScope = (
    roleCode: string,
    resource: string,
    action: string,
    scope: PermissionScope,
  ) => {
    if (saveMutation.isPending) {
      return;
    }

    setDraftMatrix((current) => ({
      ...current,
      [roleCode]: {
        ...(current[roleCode] ?? {}),
        [resource]: {
          ...(current[roleCode]?.[resource] ?? {}),
          [action]: scope,
        },
      },
    }));

    setPendingChanges((current) => {
      const key = changeKey(roleCode, resource, action);
      const original = getScope(matrixData ?? {}, roleCode, resource, action);

      if (scope === original) {
        const next = { ...current };
        delete next[key];
        return next;
      }

      return { ...current, [key]: scope };
    });
  };

  const toggleModule = (resource: string) => {
    setExpandedModules((current) => {
      const next = new Set(current);
      if (next.has(resource)) {
        next.delete(resource);
      } else {
        next.add(resource);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedModules(new Set(filteredModules.map((module) => module.resource)));
  };

  const collapseAll = () => {
    setExpandedModules(new Set());
  };

  if (matrixLoading || rolesLoading || permissionsLoading) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <PageHeader
            eyebrow="RBAC matrix"
            title="Permission management"
            description="Loading permission matrix..."
          />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  if (matrixError || rolesError || permissionsError) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <PageHeader
            eyebrow="RBAC matrix"
            title="Permission management"
            description="Failed to load permission matrix."
          />
          <SectionCard title="Error" description="Could not fetch the permission matrix.">
            <Button
              variant="outline"
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: ['permission-matrix'] });
                void queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
                void queryClient.invalidateQueries({ queryKey: ['rbac-permissions'] });
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
          description="Assign role access by resource, action, and scope without exposing the system administrator role."
        />

        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <p>System Admin has full access to all features. This cannot be modified.</p>
          </div>
        </div>

        <SectionCard
          title="Permission Matrix"
          description="Permission codes are stored in the format resource:action:scope."
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand all
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse all
              </Button>
            </div>
            <Button
              size="sm"
              disabled={pendingCount === 0 || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="shrink-0"
            >
              {saveMutation.isPending
                ? 'Saving...'
                : `Save Changes${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search permissions..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
              className="min-w-[160px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">All modules</option>
              {uniqueResources.map((resource) => (
                <option key={resource} value={resource}>
                  {resource}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full overflow-x-auto rounded-xl border border-border">
            <div className="min-w-[900px]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-slate-900/50">
                    <th className="sticky left-0 z-20 min-w-[180px] max-w-[180px] border-r border-border/50 bg-slate-900/95 px-4 py-3 text-left font-medium text-muted-foreground">
                      Permission
                    </th>
                    {roleOrder.map((roleCode) => (
                      <th
                        key={roleCode}
                        className="min-w-[100px] max-w-[120px] border-r border-border/50 px-3 py-3 text-center font-medium text-muted-foreground last:border-r-0"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="max-w-[90px] truncate text-xs">{roleLabel(roleCode)}</span>
                          <Badge variant="outline" className="text-[10px]">
                            Role
                          </Badge>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredModules.map((module) => {
                    const expanded = expandedModules.has(module.resource);

                    return (
                      <Fragment key={module.resource}>
                        <tr key={`${module.resource}-header`}>
                          <td colSpan={roleOrder.length + 1}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleModule(module.resource)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  toggleModule(module.resource);
                                }
                              }}
                              className="sticky left-0 flex cursor-pointer items-center justify-between border-b border-border bg-slate-900/60 px-4 py-3 transition-colors hover:bg-slate-900/80"
                            >
                              <div>
                                <p className="font-medium text-foreground">{module.label}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {module.rows.length} action row{module.rows.length === 1 ? '' : 's'}
                                </p>
                              </div>
                              {expanded ? (
                                <ChevronDown className="size-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="size-4 text-muted-foreground" />
                              )}
                            </div>
                          </td>
                        </tr>

                        {expanded
                          ? module.rows.map((row) => {
                              const changed = roleOrder.some((roleCode) =>
                                Boolean(
                                  pendingChanges[
                                    changeKey(roleCode, module.resource, row.action)
                                  ],
                                ),
                              );

                              return (
                                <tr
                                  key={`${module.resource}-${row.action}`}
                                  className={cn('border-b border-border/40', changed && 'bg-amber-500/5')}
                                >
                                  <td
                                    className={cn(
                                      'sticky left-0 z-10 min-w-[180px] max-w-[180px] border-r border-border bg-slate-950/90 px-4 py-2.5',
                                      changed && 'border-l-4 border-l-amber-400',
                                    )}
                                  >
                                    <span className="block truncate font-mono text-xs text-cyan-300">
                                      {module.resource}:{row.action}:scope
                                    </span>
                                  </td>

                                  {roleOrder.map((roleCode) => {
                                    const currentScope = getScope(
                                      draftMatrix,
                                      roleCode,
                                      module.resource,
                                      row.action,
                                    );

                                    return (
                                      <td
                                        key={`${module.resource}-${row.action}-${roleCode}`}
                                        className="border-r border-border/50 px-2 py-2 last:border-r-0"
                                      >
                                        <Select
                                          value={currentScope}
                                          disabled={saveMutation.isPending}
                                          onValueChange={(value) =>
                                            updateScope(
                                              roleCode,
                                              module.resource,
                                              row.action,
                                              value as PermissionScope,
                                            )
                                          }
                                        >
                                          <SelectTrigger className="h-8 min-w-[100px]">
                                            <SelectValue placeholder="Scope" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {scopeOptions.map((option) => (
                                              <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })
                          : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>
      </div>
    </PageTransition>
  );
}
