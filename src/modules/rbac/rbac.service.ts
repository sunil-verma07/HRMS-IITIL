import { RbacRepository } from './rbac.repository';
import type { AssignRoleDto, AttachPermissionDto, CreateRoleDto, SetRolePermissionDto, UpdateRoleDto } from './rbac.validation';

export class RbacService {
  constructor(private readonly repository = new RbacRepository()) {}

  listRoles() {
    return this.repository.listRoles();
  }

  listPermissions() {
    return this.repository.listPermissions();
  }

  createRole(input: CreateRoleDto) {
    return this.repository.createRole(input);
  }

  updateRole(id: string, input: UpdateRoleDto, actorUserId?: string) {
    return this.repository.updateRole(id, input, actorUserId);
  }

  deleteRole(id: string, actorUserId?: string): Promise<void> {
    return this.repository.deleteRole(id, actorUserId);
  }

  assignRole(input: AssignRoleDto): Promise<void> {
    return this.repository.assignRole(input);
  }

  attachPermission(input: AttachPermissionDto): Promise<void> {
    return this.repository.attachPermission(input);
  }

  setRolePermission(roleId: string, permissionId: string, input: SetRolePermissionDto, actorUserId?: string): Promise<void> {
    return this.repository.setRolePermission(roleId, permissionId, input, actorUserId);
  }

  async getAccessProfile(userId: string): Promise<{ roles: string[]; permissions: string[]; hierarchyLevel: number }> {
    const [roles, permissions, hierarchyLevel] = await Promise.all([
      this.repository.findRolesByUserId(userId),
      this.repository.findPermissionsByUserId(userId),
      this.repository.findRoleHierarchyLevelByUserId(userId)
    ]);

    return { roles, permissions, hierarchyLevel };
  }
}
