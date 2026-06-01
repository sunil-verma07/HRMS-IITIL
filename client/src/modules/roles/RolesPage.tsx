import { Edit3, Plus, Trash2, Loader2, X, Save } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { PageTransition } from '@/components/animations/PageTransition';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { endpoints } from '@/services/api/endpoints';
import { resourceApi } from '@/services/api/resource.api';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';

type Role = {
  id: string;
  code: string;
  name: string;
  description?: string;
  hierarchyLevel: number;
  isSystem: boolean;
  status?: 'SYSTEM' | 'ACTIVE' | 'INACTIVE';
};

const DEFAULT_ROLE: Partial<Role> = {
  code: '',
  name: '',
  description: '',
  hierarchyLevel: 100
};

export function RolesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<Partial<Role>>(DEFAULT_ROLE);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Role>) =>
      resourceApi.create<Role>(endpoints.roles, data as Role),
    onSuccess: () => {
      toast.success('Role created');
      setDialogOpen(false);
      setFormData(DEFAULT_ROLE);
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error) => toast.error(error.message)
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Role>) =>
      resourceApi.update<Role>(endpoints.roles, editingRole!.id, data as Role),
    onSuccess: () => {
      toast.success('Role updated');
      setDialogOpen(false);
      setFormData(DEFAULT_ROLE);
      setEditingRole(null);
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error) => toast.error(error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => resourceApi.remove(endpoints.roles, id),
    onSuccess: () => {
      toast.success('Role deleted');
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error) => toast.error(error.message)
  });

  const handleOpenDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setFormData(role);
    } else {
      setEditingRole(null);
      setFormData(DEFAULT_ROLE);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRole(null);
    setFormData(DEFAULT_ROLE);
  };

  const handleSubmit = () => {
    if (!formData.code || !formData.name) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (editingRole?.isSystem && editingRole.code !== formData.code) {
      toast.error('System role code cannot be changed');
      return;
    }

    if (editingRole) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="RBAC"
          title="Roles"
          description="Manage system and business roles. System roles are protected and cannot be deleted."
          actions={
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="size-4" /> Create role
            </Button>
          }
        />

        <SectionCard title="Role hierarchy" description="Roles are organized by hierarchy level for permission escalation.">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-white/[0.035] p-4">
              <div className="text-sm font-medium text-foreground">System roles</div>
              <div className="text-xs text-muted-foreground mt-1">Protected, cannot be modified or deleted</div>
              <Badge className="mt-2" variant="secondary">SYSTEM</Badge>
            </div>
            <div className="rounded-xl border border-border bg-white/[0.035] p-4">
              <div className="text-sm font-medium text-foreground">Active roles</div>
              <div className="text-xs text-muted-foreground mt-1">Business roles in use, can be modified</div>
              <Badge className="mt-2" variant="default">ACTIVE</Badge>
            </div>
            <div className="rounded-xl border border-border bg-white/[0.035] p-4">
              <div className="text-sm font-medium text-foreground">Inactive roles</div>
              <div className="text-xs text-muted-foreground mt-1">Archived roles, cannot be assigned</div>
              <Badge className="mt-2" variant="outline">INACTIVE</Badge>
            </div>
          </div>
        </SectionCard>

        <OperationalModulePage<Role>
          config={{
            resource: 'roles',
            endpoint: endpoints.roles,
            eyebrow: 'RBAC',
            title: 'Role management',
            description: 'Create, update, and manage organizational roles.',
            createLabel: 'Create role',
            columns: [
              {
                accessorKey: 'code',
                header: 'Code'
              },
              {
                accessorKey: 'name',
                header: 'Name'
              },
              {
                accessorKey: 'description',
                header: 'Description'
              },
              {
                accessorKey: 'isSystem',
                header: 'Status',
                cell: (info) => {
                  const isSystem = info.getValue() as boolean;
                  return isSystem ? (
                    <Badge variant="secondary">SYSTEM</Badge>
                  ) : (
                    <Badge variant="default">ACTIVE</Badge>
                  );
                }
              },
              {
                id: 'actions',
                header: 'Actions',
                cell: (info) => {
                  const row = info.row.original as Role;
                  return (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenDialog(row)}
                        disabled={isSubmitting || deleteMutation.isPending}
                      >
                        <Edit3 className="size-4" />
                      </Button>
                      {!row.isSystem && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-300 hover:text-rose-200"
                          onClick={() => deleteMutation.mutate(row.id)}
                          disabled={isSubmitting || deleteMutation.isPending}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  );
                }
              }
            ],
            emptyTitle: 'No roles',
            emptyDescription: 'Roles will appear after creation.'
          }}
        />

        {/* Role Editor Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => !isSubmitting && (open ? setDialogOpen(true) : handleCloseDialog())}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="size-5" />
                {editingRole ? 'Edit role' : 'Create role'}
              </DialogTitle>
              <DialogDescription>
                {editingRole?.isSystem
                  ? 'System roles are protected. Only name and description can be changed.'
                  : 'Create or modify organizational roles and their permissions.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-foreground">Role code *</span>
                <Input
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., HR_MANAGER"
                  disabled={isSubmitting || editingRole?.isSystem}
                />
                <span className="text-xs text-muted-foreground">Unique identifier for the role (cannot be changed)</span>
              </label>

              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-foreground">Role name *</span>
                <Input
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., HR Manager"
                  disabled={isSubmitting}
                />
              </label>

              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-foreground">Description</span>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Role purpose and responsibilities..."
                  disabled={isSubmitting}
                  rows={4}
                />
              </label>

              {!editingRole?.isSystem && (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-foreground">Hierarchy level</span>
                  <Input
                    type="number"
                    value={formData.hierarchyLevel || 100}
                    onChange={(e) => setFormData({ ...formData, hierarchyLevel: parseInt(e.target.value) })}
                    placeholder="e.g., 50"
                    disabled={isSubmitting}
                  />
                  <span className="text-xs text-muted-foreground">Lower number = higher authority</span>
                </label>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
                  <X className="size-4" /> Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Save role
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
