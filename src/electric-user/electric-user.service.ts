import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthActor } from 'src/common/auth-actor';
import { Client, ClientType } from 'src/client/models/client.entity';
import { Permission, PermissionType } from 'src/permission/permission.entity';
import { Role, RoleType } from 'src/role/role.entity';
import { RoleService } from 'src/role/role.service';
import { ElectricAccessService } from 'src/electric-access/electric-access.service';
import { ElectricCounter } from 'src/electric-counter/models/electric-counter.entity';
import { ElectricCounterSession, ElectricSessionStatus } from 'src/electric-counter/models/electric-counter-session.entity';
import { ElectricListDto } from 'src/common/electric.dto';
import { ElectricRoleDto, ElectricUserDto } from './models/electric-user.dto';

@Injectable()
export class ElectricUserService {
    constructor(
        private access: ElectricAccessService,
        private roleService: RoleService,
        @InjectRepository(Role, 'MainConnection') private readonly roleRepository: Repository<Role>,
        @InjectRepository(Permission, 'MainConnection') private readonly permissionRepository: Repository<Permission>,
        @InjectRepository(Client, 'MainConnection') private readonly clientRepository: Repository<Client>,
        @InjectRepository(ElectricCounter, 'MainConnection') private readonly counterRepository: Repository<ElectricCounter>,
        @InjectRepository(ElectricCounterSession, 'MainConnection') private readonly sessionRepository: Repository<ElectricCounterSession>,
    ) { }

    permissions() {
        return this.permissionRepository.find({ where: { type: PermissionType.ELECTRIC }, order: { id: 'ASC' } });
    }

    private rolesWhere(actor: AuthActor) {
        return [
            { type: RoleType.ELECTRIC, vendor: { id: actor.vendor_id } },
            { type: RoleType.ELECTRIC, vendor: IsNull(), is_system: true, name: 'Owner' },
        ];
    }

    private async roleView(role: Role) {
        const users = await this.clientRepository.count({ where: { role: { id: role.id } } });
        const { permissions, vendor, ...rest } = role as any;
        return { ...rest, permission_ids: (permissions || []).map((permission: Permission) => permission.id), permission_count: (permissions || []).length, user_count: users };
    }

    async listRoles(actor: AuthActor, body: ElectricListDto) {
        const search = String(body.search || '').toLowerCase();
        const roles = (await this.roleRepository.find({ where: this.rolesWhere(actor), relations: ['permissions'], order: { id: 'DESC' } }))
            .filter((role) => !search || role.name.toLowerCase().includes(search));
        const take = Number(body.take) || 10;
        const page = Number(body.page) || 1;
        return { data: await Promise.all(roles.slice((page - 1) * take, page * take).map((role) => this.roleView(role))), meta: { total: roles.length, page, last_page: Math.ceil(roles.length / take) } };
    }

    async dropdownRoles(actor: AuthActor) {
        const roles = await this.roleRepository.find({ where: { type: RoleType.ELECTRIC, vendor: { id: actor.vendor_id }, is_system: false }, relations: ['permissions'], order: { name: 'ASC' } });
        const grantable = [];
        for (const role of roles) {
            if (await this.roleService.canGrant(actor, role.permissions.map((permission) => permission.permission_key))) {
                grantable.push(await this.roleView(role));
            }
        }
        return grantable;
    }

    private async ownRole(actor: AuthActor, id: number, forWrite: boolean) {
        const role = await this.roleRepository.findOne({ where: { id, type: RoleType.ELECTRIC }, relations: ['permissions'] });
        if (!role || (role.vendor_id && role.vendor_id !== actor.vendor_id) || (!role.vendor_id && role.name !== 'Owner')) {
            throw new NotFoundException('Role not found');
        }
        if (forWrite && role.is_system) {
            throw new BadRequestException('The Owner role cannot be changed');
        }
        return role;
    }

    async role(actor: AuthActor, id: number) {
        return this.roleView(await this.ownRole(actor, id, false));
    }

    private async rolePayload(actor: AuthActor, body: ElectricRoleDto, exceptId?: number) {
        const name = String(body.name || '').trim();
        if (!name) throw new BadRequestException('Role title is required');
        if (['owner', 'supervisor'].includes(name.toLowerCase())) throw new BadRequestException(`You cannot create a role with the name "${name}"`);
        const clash = await this.roleRepository.findOne({ where: { type: RoleType.ELECTRIC, vendor: { id: actor.vendor_id }, name, ...(exceptId ? { id: Not(exceptId) } : {}) } });
        if (clash) throw new BadRequestException(`Role "${name}" already exists`);
        const ids = [...new Set((body.permissions || []).map(Number))];
        const permissions = ids.length ? await this.permissionRepository.find({ where: { id: In(ids), type: PermissionType.ELECTRIC } }) : [];
        if (!permissions.length) throw new BadRequestException('Tick at least one permission');
        if (permissions.length !== ids.length) throw new BadRequestException('Some permissions are not valid for an Electric Store role');
        await this.roleService.assertCanGrant(actor, permissions.map((permission) => permission.permission_key));
        return { name, permissions };
    }

    async createRole(actor: AuthActor, body: ElectricRoleDto) {
        const payload = await this.rolePayload(actor, body);
        const role = await this.roleRepository.save(this.roleRepository.create({ ...payload, type: RoleType.ELECTRIC, is_system: false, vendor: { id: actor.vendor_id } }));
        return this.role(actor, role.id);
    }

    async updateRole(actor: AuthActor, id: number, body: ElectricRoleDto) {
        const role = await this.ownRole(actor, id, true);
        await this.roleService.assertCanManageRole(actor, role.id);
        const payload = await this.rolePayload(actor, body, role.id);
        role.name = payload.name;
        role.permissions = payload.permissions;
        await this.roleRepository.save(role);
        this.roleService.clearPermissionCache(role.id);
        return this.role(actor, role.id);
    }

    async deleteRole(actor: AuthActor, id: number) {
        const role = await this.ownRole(actor, id, true);
        await this.roleService.assertCanManageRole(actor, role.id);
        const assigned = await this.roleService.assignedCount(role.id);
        if (assigned.active || assigned.deleted) throw new BadRequestException('Users still have this role. Give them another role first.');
        await this.roleRepository.delete(role.id);
        this.roleService.clearPermissionCache(role.id);
        return { message: 'Role deleted' };
    }

    private async userView(client: Client) {
        const full = await this.clientRepository.findOne({ where: { id: client.id }, relations: ['role', 'clientstore'] });
        const counter = full.electric_counter_id ? await this.counterRepository.findOne({ where: { id: full.electric_counter_id } }) : null;
        const { role, clientstore, vendor, country, city, ...rest } = full as any;
        return {
            ...rest,
            counter_id: full.electric_counter_id,
            role: role ? { id: role.id, name: role.name } : null,
            clientstore: clientstore ? { id: clientstore.id, store_name: clientstore.store_name } : null,
            counter: counter ? { id: counter.id, name: counter.name } : null,
        };
    }

    async listUsers(actor: AuthActor, body: ElectricListDto) {
        const query = this.clientRepository.createQueryBuilder('client').where('client.vendor_id = :vendorId', { vendorId: actor.vendor_id });
        if (actor.clientstore_id) query.andWhere('client.clientstore_id = :own', { own: actor.clientstore_id });
        if (body.clientstore_id) query.andWhere('client.clientstore_id = :shopId', { shopId: Number(body.clientstore_id) });
        if (body.role_id) query.andWhere('client.role_id = :roleId', { roleId: Number(body.role_id) });
        if (body.search) {
            query.andWhere(new Brackets((where) => where.where('client.full_name LIKE :search').orWhere('client.email LIKE :search').orWhere('client.phone LIKE :search')), { search: `%${body.search}%` });
        }
        const [rows, total] = await query.orderBy('client.id', 'DESC').skip(((Number(body.page) || 1) - 1) * (Number(body.take) || 10)).take(Number(body.take) || 10).getManyAndCount();
        return { data: await Promise.all(rows.map((row) => this.userView(row))), meta: { total, page: Number(body.page) || 1, last_page: Math.ceil(total / (Number(body.take) || 10)) } };
    }

    private async userPayload(actor: AuthActor, body: ElectricUserDto, existing?: Client) {
        const email = String(body.email || '').trim().toLowerCase();
        const phone = String(body.phone || '').trim();
        if (!String(body.full_name || '').trim()) throw new BadRequestException('Name is required');
        if (!/.+@.+\..+/.test(email)) throw new BadRequestException('E-mail must be valid');
        const clash = await this.clientRepository.findOne({ where: [{ email }, { phone }], withDeleted: true });
        if (clash && clash.id !== existing?.id) throw new BadRequestException(clash.email === email ? 'This email is already used' : 'This phone is already used');
        if (!existing && String(body.password || '').length < 6) throw new BadRequestException('Password must be at least 6 characters');
        const role = await this.roleRepository.findOne({ where: { id: body.role_id, type: RoleType.ELECTRIC, vendor: { id: actor.vendor_id }, is_system: false }, relations: ['permissions'] });
        if (!role) throw new BadRequestException('Choose a role');
        await this.roleService.assertCanGrant(actor, role.permissions.map((permission) => permission.permission_key));
        const shopId = body.clientstore_id ? (await this.access.shop(actor, body.clientstore_id)).id : null;
        if (!shopId && actor.clientstore_id) throw new BadRequestException('Choose a shop');
        const counter = body.counter_id ? await this.counterRepository.findOne({ where: { id: Number(body.counter_id) } }) : null;
        if (body.counter_id && (!counter || counter.clientstore_id !== shopId)) throw new BadRequestException('This counter is not in the chosen shop');
        return {
            full_name: body.full_name.trim(),
            email,
            phone,
            role: { id: role.id },
            clientstore: shopId ? { id: shopId } : null,
            electric_counter_id: counter?.id || null,
            image_url: body.image_url ?? existing?.image_url ?? null,
            is_active: body.is_active !== false,
        };
    }

    async createUser(actor: AuthActor, body: ElectricUserDto) {
        const payload = await this.userPayload(actor, body);
        const client = await this.clientRepository.save({
            ...payload,
            client_type: ClientType.SUPERVISOR,
            password: await bcrypt.hash(body.password, 12),
            vendor: { id: actor.vendor_id },
        });
        return this.userView(client);
    }

    private async ownUser(actor: AuthActor, id: number) {
        const client = await this.clientRepository.findOne({ where: { id, vendor: { id: actor.vendor_id } } });
        if (!client || (actor.clientstore_id && client.clientstore_id !== actor.clientstore_id)) throw new NotFoundException('User not found');
        if (client.client_type === ClientType.OWNER) throw new BadRequestException('The owner cannot be edited here');
        if (client.id === actor.id) throw new BadRequestException('Change your own details from My Profile');
        if (client.role_id) await this.roleService.assertCanManageRole(actor, client.role_id);
        return client;
    }

    async updateUser(actor: AuthActor, id: number, body: ElectricUserDto) {
        const client = await this.ownUser(actor, id);
        const payload: any = await this.userPayload(actor, body, client);
        if (body.password) {
            const current = await this.clientRepository.createQueryBuilder('client').addSelect('client.token_version').where('client.id = :id', { id: client.id }).getOne();
            payload.password = await bcrypt.hash(body.password, 12);
            payload.token_version = (current?.token_version || 0) + 1;
        }
        await this.clientRepository.save({ id: client.id, ...payload });
        return this.userView(client);
    }

    async deleteUser(actor: AuthActor, id: number) {
        const client = await this.ownUser(actor, id);
        if (await this.sessionRepository.findOne({ where: { cashier: { id: client.id }, status: ElectricSessionStatus.OPEN } })) {
            throw new BadRequestException('This user has an open counter. Close it first.');
        }
        if (await this.sessionRepository.count({ where: { cashier: { id: client.id } } })) {
            await this.clientRepository.update(client.id, { is_active: false });
            return { deactivated: true, message: 'This user has counter history, so they were made inactive instead of deleted.' };
        }
        await this.clientRepository.softDelete(client.id);
        return { message: 'User deleted' };
    }
}
