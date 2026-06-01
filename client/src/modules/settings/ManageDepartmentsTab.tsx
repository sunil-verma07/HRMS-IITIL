import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { endpoints } from '@/services/api/endpoints';
import { httpClient } from '@/services/api/http-client';
import type { ApiResponse } from '@/types/api';

type EmployeeCardData = {
  id: string;
  employeeId: string;
  name: string;
  designation: string;
  avatar: string | null;
};

type DepartmentTeam = {
  leadId: string;
  lead: EmployeeCardData;
  memberCount: number;
  members: EmployeeCardData[];
};

type DepartmentNode = {
  id: string;
  name: string;
  code: string;
  head: EmployeeCardData | null;
  employeeCount: number;
  teams: DepartmentTeam[];
  unassigned?: EmployeeCardData[];
  subDepartments: DepartmentNode[];
};

type DepartmentHierarchyResponse = {
  departments: DepartmentNode[];
};

type ReportingManagerOption = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation: string;
  department: string;
  profilePhoto?: string | null;
};

type TeamEditState = {
  departmentId: string;
  teamLeadId: string;
  memberIds: string[];
};

const DEPARTMENTS_QUERY_KEY = ['departments-hierarchy'];

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function colorForDepartment(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 52%)`;
}

function flattenDepartments(tree: DepartmentNode[], result: DepartmentNode[] = []): DepartmentNode[] {
  for (const item of tree) {
    result.push(item);
    flattenDepartments(item.subDepartments, result);
  }
  return result;
}

function findDepartmentById(tree: DepartmentNode[], id: string | null): DepartmentNode | null {
  if (!id) {
    return null;
  }

  for (const item of tree) {
    if (item.id === id) {
      return item;
    }

    const nested = findDepartmentById(item.subDepartments, id);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function mapDepartmentTree(
  tree: DepartmentNode[],
  targetId: string,
  mapFn: (department: DepartmentNode) => DepartmentNode
): DepartmentNode[] {
  return tree.map((department) => {
    if (department.id === targetId) {
      return mapFn(department);
    }

    return {
      ...department,
      subDepartments: mapDepartmentTree(department.subDepartments, targetId, mapFn)
    };
  });
}

function moveEmployee(
  department: DepartmentNode,
  employeeId: string,
  toLeadId: string | null,
  fallbackLeads: Map<string, EmployeeCardData>
): DepartmentNode {
  let movingMember: EmployeeCardData | null = null;

  const updatedTeams = department.teams
    .map((team) => {
      const filteredMembers = team.members.filter((member) => {
        if (member.id === employeeId) {
          movingMember = member;
          return false;
        }
        return true;
      });

      return {
        ...team,
        members: filteredMembers,
        memberCount: filteredMembers.length
      };
    })
    .filter((team) => team.memberCount > 0 || team.lead.id === toLeadId);

  const unassigned = [...(department.unassigned ?? [])].filter((member) => {
    if (member.id === employeeId) {
      movingMember = member;
      return false;
    }
    return true;
  });

  if (!movingMember) {
    return department;
  }

  if (!toLeadId) {
    return {
      ...department,
      teams: updatedTeams,
      unassigned: [...unassigned, movingMember].sort((a, b) => a.name.localeCompare(b.name))
    };
  }

  const existingTeamIndex = updatedTeams.findIndex((team) => team.leadId === toLeadId);
  if (existingTeamIndex >= 0) {
    const targetTeam = updatedTeams[existingTeamIndex];
    if (!targetTeam) {
      return department;
    }

    const nextMembers = [...targetTeam.members, movingMember].sort((a, b) => a.name.localeCompare(b.name));
    updatedTeams[existingTeamIndex] = {
      ...targetTeam,
      members: nextMembers,
      memberCount: nextMembers.length
    };

    return {
      ...department,
      teams: updatedTeams,
      unassigned
    };
  }

  const lead = fallbackLeads.get(toLeadId);
  if (!lead) {
    return department;
  }

  return {
    ...department,
    teams: [...updatedTeams, { leadId: lead.id, lead, members: [movingMember], memberCount: 1 }].sort((a, b) =>
      a.lead.name.localeCompare(b.lead.name)
    ),
    unassigned
  };
}

function DepartmentTreeItem({
  department,
  selectedDepartmentId,
  onSelect,
  onEdit,
  level
}: {
  department: DepartmentNode;
  selectedDepartmentId: string | null;
  onSelect: (id: string) => void;
  onEdit: (department: DepartmentNode) => void;
  level: number;
}) {
  const selected = selectedDepartmentId === department.id;
  const accentColor = colorForDepartment(department.name);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onSelect(department.id)}
        className={cn(
          'group relative flex w-full items-center justify-between rounded-xl border border-border/60 bg-white/[0.03] px-3 py-2 text-left transition-all duration-200',
          selected && 'border-cyan-400/50 bg-cyan-400/[0.10]'
        )}
        style={{ marginLeft: `${level * 14}px`, borderLeftColor: accentColor, borderLeftWidth: 3 }}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{department.name}</p>
          <p className="text-xs text-muted-foreground">{department.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs text-muted-foreground">
            {department.employeeCount}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(department);
            }}
            className="opacity-0 transition group-hover:opacity-100"
            aria-label={`Edit ${department.name}`}
          >
            <Pencil className="size-3.5 text-muted-foreground" />
          </button>
        </div>
      </button>
      {department.subDepartments.map((subDepartment) => (
        <DepartmentTreeItem
          key={subDepartment.id}
          department={subDepartment}
          selectedDepartmentId={selectedDepartmentId}
          onSelect={onSelect}
          onEdit={onEdit}
          level={level + 1}
        />
      ))}
    </div>
  );
}

function EmployeeAvatar({ employee }: { employee: EmployeeCardData }) {
  return (
    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-cyan-300/10 text-[11px] font-semibold text-cyan-200">
      {employee.avatar ? <img src={employee.avatar} alt={employee.name} className="h-full w-full rounded-lg object-cover" /> : initials(employee.name)}
    </div>
  );
}

function SortableEmployeeCard({
  employee,
  draggable
}: {
  employee: EmployeeCardData;
  draggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: employee.id,
    disabled: !draggable
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      className={cn(
        'flex items-center gap-2 rounded-xl border border-border bg-slate-950/70 p-2 text-left shadow-sm transition',
        isDragging && 'scale-[1.02] shadow-xl ring-2 ring-cyan-300/50'
      )}
    >
      <div
        {...listeners}
        className={cn('flex items-center pr-1 text-muted-foreground', !draggable && 'opacity-0')}
        aria-hidden={!draggable}
      >
        <GripVertical className="size-3.5" />
      </div>
      <EmployeeAvatar employee={employee} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{employee.name}</p>
        <p className="truncate text-xs text-muted-foreground">{employee.designation}</p>
      </div>
    </div>
  );
}

function TeamColumn({
  id,
  title,
  subtitle,
  employees,
  accent,
  draggable,
  menu,
  emptyState
}: {
  id: string;
  title: string;
  subtitle: string;
  employees: EmployeeCardData[];
  accent: string;
  draggable: boolean;
  menu?: ReactNode;
  
  emptyState: string;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-full min-h-[26rem] w-72 min-w-[18rem] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-white/[0.02]',
        isOver && 'ring-2 ring-cyan-300/40'
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3" style={{ background: accent }}>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {menu}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <SortableContext items={employees.map((employee) => employee.id)} strategy={verticalListSortingStrategy}>
          {employees.length > 0 ? (
            employees.map((employee) => (
              <SortableEmployeeCard key={employee.id} employee={employee} draggable={draggable} />
            ))
          ) : (
            <div className="grid min-h-[8rem] place-items-center rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              {emptyState}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function SlideModal({
  open,
  title,
  description,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-2xl rounded-t-3xl border border-border bg-slate-950 p-6"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          >
            <div className="mb-4">
              <p className="text-lg font-semibold text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function ManageDepartmentsTab() {
  const queryClient = useQueryClient();
  const { roles } = usePermissions();
  const canManage = roles.includes('SUPER_ADMIN') || roles.includes('ADMIN');

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [extraTeamLeads, setExtraTeamLeads] = useState<Record<string, string[]>>({});

  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [departmentEditing, setDepartmentEditing] = useState<DepartmentNode | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [departmentCode, setDepartmentCode] = useState('');
  const [parentDepartmentId, setParentDepartmentId] = useState<string>('');
  const [headEmployeeId, setHeadEmployeeId] = useState<string>('');

  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [teamLeadId, setTeamLeadId] = useState('');
  const [teamEditState, setTeamEditState] = useState<TeamEditState | null>(null);
  const [teamActionLeadId, setTeamActionLeadId] = useState('');

  const [employeeSearch, setEmployeeSearch] = useState('');
  const debouncedEmployeeSearch = useDebounce(employeeSearch, 250);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: DEPARTMENTS_QUERY_KEY,
    queryFn: async () => {
      const response = await httpClient.get<ApiResponse<DepartmentHierarchyResponse>>(endpoints.departments.list);
      return response.data.data;
    }
  });

  const managerOptionsQuery = useQuery({
    queryKey: ['reporting-manager-options', debouncedEmployeeSearch],
    queryFn: async () => {
      const response = await httpClient.get<ApiResponse<ReportingManagerOption[]>>(
        endpoints.employeeReportingManagerOptions,
        {
          params: {
            ...(debouncedEmployeeSearch ? { search: debouncedEmployeeSearch } : {})
          }
        }
      );
      return response.data.data;
    },
    enabled: departmentModalOpen,
    staleTime: 30_000
  });

  useEffect(() => {
    if (!selectedDepartmentId && data?.departments?.[0]) {
      setSelectedDepartmentId(data.departments[0].id);
    }
  }, [data, selectedDepartmentId]);

  const flatDepartments = useMemo(() => flattenDepartments(data?.departments ?? []), [data?.departments]);
  const selectedDepartment = useMemo(
    () => findDepartmentById(data?.departments ?? [], selectedDepartmentId),
    [data?.departments, selectedDepartmentId]
  );

  const allDepartmentEmployees = useMemo(() => {
    if (!selectedDepartment) {
      return [] as EmployeeCardData[];
    }

    const dedupe = new Map<string, EmployeeCardData>();
    for (const team of selectedDepartment.teams) {
      dedupe.set(team.lead.id, team.lead);
      for (const member of team.members) {
        dedupe.set(member.id, member);
      }
    }

    for (const member of selectedDepartment.unassigned ?? []) {
      dedupe.set(member.id, member);
    }

    return [...dedupe.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedDepartment]);

  const employeeById = useMemo(() => new Map(allDepartmentEmployees.map((employee) => [employee.id, employee])), [allDepartmentEmployees]);

  const updateReportingManagerMutation = useMutation({
    mutationFn: async ({ employeeId, reportingManagerId }: { employeeId: string; reportingManagerId: string | null }) => {
      await httpClient.patch<ApiResponse<unknown>>(endpoints.employeeReportingManager(employeeId), { reportingManagerId });
    },
    onMutate: async ({ employeeId, reportingManagerId }) => {
      if (!selectedDepartmentId) {
        return { previous: queryClient.getQueryData(DEPARTMENTS_QUERY_KEY) };
      }

      await queryClient.cancelQueries({ queryKey: DEPARTMENTS_QUERY_KEY });
      const previous = queryClient.getQueryData<DepartmentHierarchyResponse>(DEPARTMENTS_QUERY_KEY);

      queryClient.setQueryData<DepartmentHierarchyResponse>(DEPARTMENTS_QUERY_KEY, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          departments: mapDepartmentTree(current.departments, selectedDepartmentId, (department) =>
            moveEmployee(department, employeeId, reportingManagerId, employeeById)
          )
        };
      });

      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(DEPARTMENTS_QUERY_KEY, context.previous);
      }
      toast.error(error.message || 'Failed to update reporting manager');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['user-management'] });
    }
  });

  const upsertDepartmentMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: departmentName.trim(),
        code: departmentCode.trim().toUpperCase(),
        ...(headEmployeeId ? { headEmployeeId } : {}),
        ...(parentDepartmentId ? { parentDepartmentId } : {})
      };

      if (departmentEditing) {
        await httpClient.patch<ApiResponse<unknown>>(endpoints.departments.detail(departmentEditing.id), payload);
      } else {
        await httpClient.post<ApiResponse<unknown>>(endpoints.departments.list, payload);
      }
    },
    onSuccess: () => {
      toast.success(departmentEditing ? 'Department updated' : 'Department created');
      setDepartmentModalOpen(false);
      resetDepartmentModal();
      void queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEY });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save department')
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } })
  );

  function resetDepartmentModal(): void {
    setDepartmentEditing(null);
    setDepartmentName('');
    setDepartmentCode('');
    setParentDepartmentId('');
    setHeadEmployeeId('');
    setEmployeeSearch('');
  }

  function openCreateDepartmentModal(): void {
    resetDepartmentModal();
    setDepartmentModalOpen(true);
  }

  function openEditDepartmentModal(department: DepartmentNode): void {
    setDepartmentEditing(department);
    setDepartmentName(department.name);
    setDepartmentCode(department.code);
    setParentDepartmentId('');
    setHeadEmployeeId(department.head?.id ?? '');
    setDepartmentModalOpen(true);
  }

  function onDragEnd(event: DragEndEvent): void {
    if (!canManage) {
      return;
    }

    const overId = event.over ? String(event.over.id) : null;
    const activeId = String(event.active.id);

    if (!overId || !selectedDepartment) {
      return;
    }

    const destinationLeadId = overId === 'unassigned' ? null : overId.replace('team:', '');
    const currentLead = selectedDepartment.teams.find((team) => team.members.some((member) => member.id === activeId));
    const isInUnassigned = (selectedDepartment.unassigned ?? []).some((member) => member.id === activeId);
    const currentLeadId = isInUnassigned ? null : currentLead?.leadId ?? null;

    if (currentLeadId === destinationLeadId) {
      return;
    }

    updateReportingManagerMutation.mutate({ employeeId: activeId, reportingManagerId: destinationLeadId });
  }

  async function applyTeamAction(nextLeadId: string | null): Promise<void> {
    if (!teamEditState || !canManage) {
      return;
    }

    try {
      await Promise.all(
        teamEditState.memberIds.map((memberId) =>
          httpClient.patch(endpoints.employeeReportingManager(memberId), { reportingManagerId: nextLeadId })
        )
      );

      toast.success(nextLeadId ? 'Team lead updated' : 'Team members moved to Unassigned');
      setTeamEditState(null);
      setTeamActionLeadId('');
      void queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEY });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update team';
      toast.error(message);
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[30%_1fr]">
        <div className="h-[32rem] animate-pulse rounded-2xl bg-white/[0.04]" />
        <div className="h-[32rem] animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">Failed to load departments.</p>
        <Button variant="outline" className="mt-3" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data?.departments?.length) {
    return (
      <div className="grid min-h-[28rem] place-items-center rounded-2xl border border-dashed border-border bg-white/[0.03] p-8 text-center">
        <div>
          <Building2 className="mx-auto mb-3 size-8 text-cyan-200" />
          <p className="text-lg font-semibold text-foreground">No departments yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first department to build teams and reporting hierarchy.</p>
          {canManage ? (
            <Button className="mt-4" onClick={openCreateDepartmentModal}>
              <Plus className="size-4" />
              Add Department
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const selectedColor = colorForDepartment(selectedDepartment?.name ?? 'Department');
  const selectedAccent = selectedColor.replace('52%', '16%');
  const explicitLeads = selectedDepartment ? extraTeamLeads[selectedDepartment.id] ?? [] : [];

  const ghostTeams = explicitLeads
    .filter((leadId) => !(selectedDepartment?.teams ?? []).some((team) => team.leadId === leadId))
    .map((leadId) => employeeById.get(leadId))
    .filter((value): value is EmployeeCardData => Boolean(value));

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[30%_1fr]">
        <section className="rounded-2xl border border-border bg-white/[0.02] p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Organization</p>
            {canManage ? (
              <Button size="sm" onClick={openCreateDepartmentModal}>
                <Plus className="size-4" />
                Add Department
              </Button>
            ) : null}
          </div>
          <div className="space-y-2">
            {data.departments.map((department) => (
              <DepartmentTreeItem
                key={department.id}
                department={department}
                selectedDepartmentId={selectedDepartmentId}
                onSelect={setSelectedDepartmentId}
                onEdit={openEditDepartmentModal}
                level={0}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white/[0.02] p-4">
          {selectedDepartment ? (
            <>
              <div className="mb-4 rounded-2xl border border-border/70 p-4" style={{ borderLeftColor: selectedColor, borderLeftWidth: 4 }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold text-foreground">{selectedDepartment.name}</p>
                    <p className="text-sm text-muted-foreground">Code: {selectedDepartment.code}</p>
                  </div>
                  {canManage ? (
                    <Button variant="outline" size="sm" onClick={() => openEditDepartmentModal(selectedDepartment)}>
                      <Pencil className="size-4" />
                      Edit Department
                    </Button>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-black/30 px-3 py-1">Head: {selectedDepartment.head?.name ?? 'Not assigned'}</span>
                  <span className="rounded-full bg-black/30 px-3 py-1">Employees: {selectedDepartment.employeeCount}</span>
                </div>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
                <div className="overflow-x-auto pb-2">
                  <div className="inline-flex min-w-full gap-3 align-top">
                    <AnimatePresence>
                      {selectedDepartment.teams.map((team, index) => (
                        <motion.div
                          key={team.leadId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.06 }}
                        >
                          <TeamColumn
                            id={`team:${team.leadId}`}
                            title={team.lead.name}
                            subtitle={`${team.memberCount} members`}
                            employees={team.members}
                            accent={selectedAccent}
                            draggable={canManage}
                            emptyState="No members yet. Drag employees here."
                            menu={
                              canManage ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button type="button" className="rounded p-1 text-muted-foreground hover:bg-white/10">
                                      <MoreHorizontal className="size-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setTeamEditState({
                                          departmentId: selectedDepartment.id,
                                          teamLeadId: team.leadId,
                                          memberIds: team.members.map((member) => member.id)
                                        });
                                        setTeamActionLeadId(team.leadId);
                                      }}
                                    >
                                      Edit Team Lead
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setTeamEditState({
                                          departmentId: selectedDepartment.id,
                                          teamLeadId: team.leadId,
                                          memberIds: team.members.map((member) => member.id)
                                        });
                                        setTeamActionLeadId('');
                                      }}
                                      className="text-rose-300"
                                    >
                                      Delete Team
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : null
                            }
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {ghostTeams.map((lead, index) => (
                      <motion.div
                        key={`ghost-${lead.id}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.06 + 0.1 }}
                      >
                        <TeamColumn
                          id={`team:${lead.id}`}
                          title={lead.name}
                          subtitle="0 members"
                          employees={[]}
                          accent={selectedAccent}
                          draggable={canManage}
                          emptyState="No members yet. Drag employees here."
                        />
                      </motion.div>
                    ))}

                    <TeamColumn
                      id="unassigned"
                      title="Unassigned"
                      subtitle={`${selectedDepartment.unassigned?.length ?? 0} employees`}
                      employees={selectedDepartment.unassigned ?? []}
                      accent="hsl(222 12% 14%)"
                      draggable={canManage}
                      emptyState="No unassigned employees."
                    />

                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => {
                          setTeamLeadId('');
                          setTeamModalOpen(true);
                        }}
                        className="grid h-[26rem] w-72 min-w-[18rem] place-items-center rounded-2xl border border-dashed border-border bg-white/[0.02] text-sm text-muted-foreground transition hover:border-cyan-300/50 hover:text-cyan-200"
                      >
                        <span className="flex items-center gap-2">
                          <Plus className="size-4" />
                          Add Team
                        </span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </DndContext>

              {!selectedDepartment.teams.length && !(selectedDepartment.unassigned?.length ?? 0) ? (
                <div className="mt-4 grid min-h-36 place-items-center rounded-2xl border border-dashed border-border text-center">
                  <div>
                    <Users className="mx-auto mb-2 size-6 text-cyan-200" />
                    <p className="font-medium text-foreground">No teams yet</p>
                    <p className="text-sm text-muted-foreground">Add a team to organize employees.</p>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </div>

      <SlideModal
        open={departmentModalOpen}
        onClose={() => {
          if (!upsertDepartmentMutation.isPending) {
            setDepartmentModalOpen(false);
            resetDepartmentModal();
          }
        }}
        title={departmentEditing ? 'Edit Department' : 'Add Department'}
        description="Create or update department hierarchy and ownership"
      >
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Department Name</span>
            <Input value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Department Code</span>
            <Input value={departmentCode} onChange={(event) => setDepartmentCode(event.target.value.toUpperCase())} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Department Head</span>
            <Input
              placeholder="Search employee"
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
            />
            <div className="max-h-32 overflow-y-auto rounded-lg border border-border">
              {(managerOptionsQuery.data ?? []).map((employee) => {
                const fullName = `${employee.firstName} ${employee.lastName}`.trim();
                return (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => setHeadEmployeeId(employee.id)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5',
                      headEmployeeId === employee.id && 'bg-cyan-400/10'
                    )}
                  >
                    <span>{fullName}</span>
                    <span className="text-xs text-muted-foreground">{employee.designation}</span>
                  </button>
                );
              })}
            </div>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Parent Department</span>
            <select
              value={parentDepartmentId}
              onChange={(event) => setParentDepartmentId(event.target.value)}
              className="h-10 rounded-lg border border-input bg-slate-950/55 px-3 text-sm"
            >
              <option value="">No parent</option>
              {flatDepartments
                .filter((department) => department.id !== departmentEditing?.id)
                .map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setDepartmentModalOpen(false);
              resetDepartmentModal();
            }}
            disabled={upsertDepartmentMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => upsertDepartmentMutation.mutate()}
            disabled={!departmentName.trim() || !departmentCode.trim() || upsertDepartmentMutation.isPending}
          >
            {upsertDepartmentMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save Department
          </Button>
        </div>
      </SlideModal>

      <SlideModal
        open={teamModalOpen}
        onClose={() => setTeamModalOpen(false)}
        title="Add Team"
        description="Select a team lead from employees in this department"
      >
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
          {allDepartmentEmployees.map((employee) => (
            <button
              key={employee.id}
              type="button"
              onClick={() => setTeamLeadId(employee.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/5',
                teamLeadId === employee.id && 'bg-cyan-400/10'
              )}
            >
              <EmployeeAvatar employee={employee} />
              <div>
                <p className="text-sm font-medium text-foreground">{employee.name}</p>
                <p className="text-xs text-muted-foreground">{employee.designation}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setTeamModalOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!teamLeadId || !selectedDepartment}
            onClick={() => {
              if (!selectedDepartment || !teamLeadId) {
                return;
              }

              setExtraTeamLeads((current) => {
                const currentLeads = current[selectedDepartment.id] ?? [];
                if (currentLeads.includes(teamLeadId)) {
                  return current;
                }

                return {
                  ...current,
                  [selectedDepartment.id]: [...currentLeads, teamLeadId]
                };
              });

              toast.success('Team lead selected. Drag employees to this column to form the team.');
              setTeamModalOpen(false);
            }}
          >
            Save Team Lead
          </Button>
        </div>
      </SlideModal>

      <SlideModal
        open={Boolean(teamEditState)}
        onClose={() => setTeamEditState(null)}
        title={teamActionLeadId ? 'Edit Team Lead' : 'Delete Team'}
        description={
          teamActionLeadId
            ? 'Reassign all current team members to another lead'
            : 'Move all team members to Unassigned'
        }
      >
        {teamActionLeadId ? (
          <div className="max-h-60 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
            {allDepartmentEmployees.map((employee) => (
              <button
                key={employee.id}
                type="button"
                onClick={() => setTeamActionLeadId(employee.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/5',
                  teamActionLeadId === employee.id && 'bg-cyan-400/10'
                )}
              >
                <EmployeeAvatar employee={employee} />
                <div>
                  <p className="text-sm font-medium text-foreground">{employee.name}</p>
                  <p className="text-xs text-muted-foreground">{employee.designation}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Team members will be moved to the Unassigned column.
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setTeamEditState(null)}>
            Cancel
          </Button>
          <Button
            variant={teamActionLeadId ? 'default' : 'destructive'}
            onClick={() => {
              if (teamActionLeadId) {
                void applyTeamAction(teamActionLeadId);
                return;
              }

              void applyTeamAction(null);
            }}
          >
            {teamActionLeadId ? 'Update Team Lead' : <Trash2 className="size-4" />}
            {teamActionLeadId ? null : 'Delete Team'}
          </Button>
        </div>
      </SlideModal>
    </>
  );
}
