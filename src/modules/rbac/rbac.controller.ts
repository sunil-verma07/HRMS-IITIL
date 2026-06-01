import type { Request, Response } from 'express';
import { ForbiddenError } from '../../common/errors/app-error';
import { sendSuccess } from '../../common/http/api-response';
import { HttpStatus } from '../../common/http/status-codes';
import { RbacService } from './rbac.service';

export class RbacController {
  constructor(private readonly rbacService = new RbacService()) {}

  listRoles = async (_request: Request, response: Response): Promise<Response> => {
    const roles = await this.rbacService.listRoles();

    return sendSuccess(response, 'Roles retrieved', roles, HttpStatus.OK);
  };

  listPermissions = async (_request: Request, response: Response): Promise<Response> => {
    const permissions = await this.rbacService.listPermissions();

    return sendSuccess(response, 'Permissions retrieved', permissions, HttpStatus.OK);
  };

  getPermissionMatrix = async (_request: Request, response: Response): Promise<Response> => {
    const matrix = await this.rbacService.getPermissionMatrix();

    return sendSuccess(response, 'Permission matrix retrieved', matrix, HttpStatus.OK);
  };

  createRole = async (request: Request, response: Response): Promise<Response> => {
    const role = await this.rbacService.createRole(request.body);

    return sendSuccess(response, 'Role created', role, HttpStatus.CREATED);
  };

  updateRole = async (request: Request, response: Response): Promise<Response> => {
    const role = await this.rbacService.updateRole(request.params.id as string, request.body, request.user?.id);

    return sendSuccess(response, 'Role updated', role, HttpStatus.OK);
  };

  deleteRole = async (request: Request, response: Response): Promise<Response> => {
    await this.rbacService.deleteRole(request.params.id as string, request.user?.id);

    return sendSuccess(response, 'Role deleted', null, HttpStatus.OK);
  };

  assignRole = async (request: Request, response: Response): Promise<Response> => {
    await this.rbacService.assignRole(request.body);

    return sendSuccess(response, 'Role assigned', null, HttpStatus.CREATED);
  };

  attachPermission = async (request: Request, response: Response): Promise<Response> => {
    await this.rbacService.attachPermission(request.body);

    return sendSuccess(response, 'Permission attached', null, HttpStatus.CREATED);
  };

  setRolePermission = async (request: Request, response: Response): Promise<Response> => {
    await this.rbacService.setRolePermission(request.params.roleId as string, request.params.permissionId as string, request.body, request.user?.id);

    return sendSuccess(response, 'Role permission updated', null, HttpStatus.OK);
  };

  updatePermissionMatrix = async (request: Request, response: Response): Promise<Response> => {
    const roles = request.user?.roles ?? [];
    if (!roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenError('Only SUPER_ADMIN can update permission matrix');
    }

    const matrix = await this.rbacService.updatePermissionMatrix(request.body, request.user?.id);

    return sendSuccess(response, 'Permission matrix updated', matrix, HttpStatus.OK);
  };
}
