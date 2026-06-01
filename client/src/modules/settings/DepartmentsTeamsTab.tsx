import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { endpoints } from '@/services/api/endpoints';
import { httpClient } from '@/services/api/http-client';
import type { ApiResponse } from '@/types/api';

type TeamConfig = {
  id: string;
  name: string;
  department: string;
  memberIds: string[];
};

type EmployeeItem = {
  id: string;
  firstName: string;
  lastName: string;
  designation: string;
  department: string;
};

function DropZone({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-24 rounded-xl border p-3 transition-colors ${
        isOver ? 'border-cyan-400/70 bg-cyan-500/10' : 'border-border/60 bg-white/[0.02]'
      }`}
    >
      {children}
    </div>
  );
}

function SortableEmployeeCard({ employee }: { employee: EmployeeItem }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: employee.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-lg border border-border/60 bg-white/[0.04] px-3 py-2 active:cursor-grabbing"
    >
      <p className="text-sm font-medium text-foreground">
        {employee.firstName} {employee.lastName}
      </p>
      <p className="text-xs text-muted-foreground">
        {employee.designation} · {employee.department}
      </p>
    </div>
  );
}

export function DepartmentsTeamsTab() {
  const sensors = useSensors(useSensor(PointerSensor));
  const [departments, setDepartments] = useState<string[]>([]);
  const [teams, setTeams] = useState<TeamConfig[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});
  const [departmentInput, setDepartmentInput] = useState('');
  const [teamNameInput, setTeamNameInput] = useState('');
  const [teamDepartment, setTeamDepartment] = useState('');

  const { data: departmentsConfig = [] } = useQuery({
    queryKey: ['config', 'hr.departments'],
    queryFn: async () => {
      const response = await httpClient.get<ApiResponse<{ key: string; value: string[] }>>(
        endpoints.config.byKey('hr.departments'),
      );
      return response.data.data?.value ?? [];
    },
    staleTime: 60_000,
  });

  const { data: teamsConfig = [] } = useQuery({
    queryKey: ['config', 'hr.teams'],
    queryFn: async () => {
      const response = await httpClient.get<ApiResponse<{ key: string; value: TeamConfig[] }>>(
        endpoints.config.byKey('hr.teams'),
      );
      return response.data.data?.value ?? [];
    },
    staleTime: 60_000,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'team-assignment'],
    queryFn: async () => {
      const response = await httpClient.get<ApiResponse<{ items: EmployeeItem[] }>>(
        endpoints.userManagement.users,
        {
          params: { limit: 200 },
        },
      );
      return response.data.data?.items ?? [];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    setDepartments(departmentsConfig);
  }, [departmentsConfig]);

  useEffect(() => {
    setTeams(teamsConfig);
  }, [teamsConfig]);

  useEffect(() => {
    const nextAssignments: Record<string, string | null> = {};
    for (const employee of employees) {
      nextAssignments[employee.id] = null;
    }

    for (const team of teamsConfig) {
      for (const memberId of team.memberIds ?? []) {
        if (memberId in nextAssignments) {
          nextAssignments[memberId] = team.id;
        }
      }
    }

    setAssignments(nextAssignments);
  }, [employees, teamsConfig]);

  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const poolMembers = useMemo(
    () => employees.filter((employee) => !assignments[employee.id]),
    [assignments, employees],
  );

  const membersByTeam = useMemo(() => {
    const map: Record<string, EmployeeItem[]> = {};
    for (const team of teams) {
      map[team.id] = employees.filter((employee) => assignments[employee.id] === team.id);
    }
    return map;
  }, [assignments, employees, teams]);

  const findContainer = (itemId: string): string | null => {
    if (itemId === 'pool' || itemId.startsWith('team:')) {
      return itemId;
    }

    const ownerTeam = assignments[itemId];
    if (!ownerTeam) return 'pool';
    return `team:${ownerTeam}`;
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    if (!employeeMap.has(activeId)) return;

    const overContainer = findContainer(String(over.id));
    if (!overContainer) return;

    if (overContainer === 'pool') {
      setAssignments((current) => ({ ...current, [activeId]: null }));
      return;
    }

    const teamId = overContainer.replace('team:', '');
    setAssignments((current) => ({ ...current, [activeId]: teamId }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const nextTeams: TeamConfig[] = teams.map((team) => ({
        ...team,
        memberIds: employees
          .filter((employee) => assignments[employee.id] === team.id)
          .map((employee) => employee.id),
      }));

      await Promise.all([
        httpClient.put(endpoints.config.byKey('hr.departments'), { value: departments }),
        httpClient.put(endpoints.config.byKey('hr.teams'), { value: nextTeams }),
      ]);
    },
    onSuccess: () => {
      toast.success('Departments and teams updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save departments and teams');
    },
  });

  const addDepartment = () => {
    const value = departmentInput.trim();
    if (!value) return;
    if (departments.includes(value)) {
      toast.error('Department already exists');
      return;
    }
    setDepartments((current) => [...current, value]);
    if (!teamDepartment) setTeamDepartment(value);
    setDepartmentInput('');
  };

  const removeDepartment = (department: string) => {
    setDepartments((current) => current.filter((item) => item !== department));
    setTeams((current) =>
      current.map((team) =>
        team.department === department ? { ...team, department: '' } : team,
      ),
    );
  };

  const addTeam = () => {
    const name = teamNameInput.trim();
    if (!name) return;
    if (!teamDepartment) {
      toast.error('Select a department for the team');
      return;
    }

    setTeams((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name,
        department: teamDepartment,
        memberIds: [],
      },
    ]);
    setTeamNameInput('');
  };

  const removeTeam = (teamId: string) => {
    setTeams((current) => current.filter((team) => team.id !== teamId));
    setAssignments((current) => {
      const next = { ...current };
      for (const [employeeId, assignedTeamId] of Object.entries(current)) {
        if (assignedTeamId === teamId) {
          next[employeeId] = null;
        }
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Departments</h3>
        </div>
        <div className="mb-3 flex gap-2">
          <Input
            value={departmentInput}
            onChange={(event) => setDepartmentInput(event.target.value)}
            placeholder="Add department"
          />
          <Button type="button" variant="outline" onClick={addDepartment}>
            <Plus className="mr-1 size-4" />
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {departments.map((department) => (
            <div
              key={department}
              className="flex items-center gap-2 rounded-lg border border-border bg-white/[0.03] px-3 py-1.5 text-sm"
            >
              <span>{department}</span>
              <button
                type="button"
                className="text-rose-400 hover:text-rose-300"
                onClick={() => removeDepartment(department)}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <h3 className="mb-3 text-sm font-semibold">Teams</h3>
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <Input
            value={teamNameInput}
            onChange={(event) => setTeamNameInput(event.target.value)}
            placeholder="Team name"
          />
          <Select value={teamDepartment} onValueChange={setTeamDepartment}>
            <SelectTrigger>
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department} value={department}>
                  {department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={addTeam}>
            <Plus className="mr-1 size-4" />
            Add Team
          </Button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Unassigned Employees</Label>
              <DropZone id="pool">
                <SortableContext
                  items={poolMembers.map((employee) => employee.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {poolMembers.map((employee) => (
                      <SortableEmployeeCard key={employee.id} employee={employee} />
                    ))}
                  </div>
                </SortableContext>
              </DropZone>
            </div>

            {teams.map((team) => {
              const members = membersByTeam[team.id] ?? [];
              return (
                <div key={team.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {team.department || 'No department'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-rose-400 hover:text-rose-300"
                      onClick={() => removeTeam(team.id)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <DropZone id={`team:${team.id}`}>
                    <SortableContext
                      items={members.map((employee) => employee.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {members.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Drop employees here
                          </p>
                        ) : (
                          members.map((employee) => (
                            <SortableEmployeeCard key={employee.id} employee={employee} />
                          ))
                        )}
                      </div>
                    </SortableContext>
                  </DropZone>
                </div>
              );
            })}
          </div>
        </DndContext>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          <Save className="mr-2 size-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save Departments & Teams'}
        </Button>
      </div>
    </div>
  );
}
