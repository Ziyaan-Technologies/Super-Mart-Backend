import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from 'src/auth/auth.service';
import { RoleService } from 'src/role/role.service';
import { ActorType } from 'src/common/auth-actor';
import { IS_PUBLIC_KEY } from 'src/common/public.decorator';
import { ACTOR_TYPES_KEY } from 'src/common/actor-types.decorator';
import { ELECTRIC_API_KEY } from 'src/common/electric-api.decorator';
import { BusinessType } from 'src/vendor/models/vendor.entity';
import { PERMISSION_KEY } from './has-permission.decorator';
import { PermissionType } from './permission.entity';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authService: AuthService,
    private roleService: RoleService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.authService.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing JWT token in header or cookie');
    }

    const actor = await this.authService.resolveActor(token);
    request.actor = actor;

    const actorTypes = this.reflector.getAllAndOverride<ActorType[]>(ACTOR_TYPES_KEY, targets);
    if (actorTypes?.length && !actorTypes.includes(actor.type)) {
      throw new ForbiddenException('This endpoint is not available for your account type');
    }

    const electricApi = this.reflector.getAllAndOverride<boolean>(ELECTRIC_API_KEY, targets);
    if (electricApi && actor.business_type !== BusinessType.ELECTRIC) {
      throw new ForbiddenException('This endpoint is only for Electric Store accounts');
    }

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSION_KEY, targets);
    if (!required?.length) {
      return true;
    }

    if (actor.type === ActorType.USER) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    const types = electricApi ? [PermissionType.ELECTRIC] : [PermissionType.ADMIN, PermissionType.VENDOR];
    const granted = await this.roleService.permissionKeys(actor.role_id, types);
    if (!required.some((key) => granted.has(key))) {
      throw new ForbiddenException(`Missing permission: ${required.join(' or ')}`);
    }

    return true;
  }
}
