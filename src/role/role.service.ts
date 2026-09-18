import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { ActorType, AuthActor } from 'src/common/auth-actor';
import { Role } from './role.entity';

@Injectable()
export class RoleService extends AbstractService {
    private permissionCache = new Map<number, { keys: Set<string>, expires_at: number }>();
    private readonly cacheTtl = 60 * 1000;

    constructor(
        @InjectRepository(Role, 'MainConnection') private readonly roleRepository: Repository<Role>
    ) {
        super(roleRepository);
    }

    async permissionKeys(roleId: number): Promise<Set<string>> {
        if (!roleId) {
            return new Set();
        }
        const cached = this.permissionCache.get(roleId);
        if (cached && cached.expires_at > Date.now()) {
            return cached.keys;
        }
        const role = await this.roleRepository.findOne({ where: { id: roleId }, relations: ['permissions'] });
        const keys = new Set<string>((role?.permissions || []).map((permission) => permission.permission_key));
        this.permissionCache.set(roleId, { keys, expires_at: Date.now() + this.cacheTtl });
        return keys;
    }

    clearPermissionCache(roleId?: number) {
        if (roleId) {
            this.permissionCache.delete(roleId);
        } else {
            this.permissionCache.clear();
        }
    }

    async isLimitedGrantor(actor: AuthActor) {
        return actor.type === ActorType.CLIENT && actor.client_type !== 'Owner';
    }

    async canGrant(actor: AuthActor, permissionKeys: Iterable<string>): Promise<boolean> {
        if (!(await this.isLimitedGrantor(actor))) {
            return true;
        }
        const own = await this.permissionKeys(actor.role_id);
        return Array.from(permissionKeys).every((key) => own.has(key));
    }

    async assertCanGrant(actor: AuthActor, permissionKeys: Iterable<string>) {
        if (!(await this.canGrant(actor, permissionKeys))) {
            throw new ForbiddenException('You cannot grant permissions that your own role does not have');
        }
    }

    async assertCanManageRole(actor: AuthActor, roleId: number) {
        if (!(await this.canGrant(actor, await this.permissionKeys(roleId)))) {
            throw new ForbiddenException('You cannot manage an account with more permissions than your own');
        }
    }

    async assignedCount(roleId: number): Promise<{ active: number; deleted: number }> {
        const [{ admins, deleted_admins }] = await this.roleRepository.query(
            'SELECT COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) AS admins, COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) AS deleted_admins FROM admins WHERE role_id = ?',
            [roleId],
        );
        const [{ clients, deleted_clients }] = await this.roleRepository.query(
            'SELECT COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) AS clients, COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) AS deleted_clients FROM clients WHERE role_id = ?',
            [roleId],
        );
        return { active: Number(admins) + Number(clients), deleted: Number(deleted_admins) + Number(deleted_clients) };
    }
}
