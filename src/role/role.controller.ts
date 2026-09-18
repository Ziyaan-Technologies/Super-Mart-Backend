import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { IsNull, Not } from 'typeorm';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { buildWhere, dateRangeCondition, growth, previousDateRangeCondition, sortOrder } from 'src/common/list-query';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { PermissionService } from 'src/permission/permission.service';
import { PermissionType } from 'src/permission/permission.entity';
import { Role, RoleType } from './role.entity';
import { RoleService } from './role.service';
import { RoleCreateDto, RoleListDto, RoleUpdateDto } from './role.dto';

@ActorTypes(ActorType.ADMIN, ActorType.CLIENT)
@Controller('roles')
export class RoleController {
    constructor(
        private roleService: RoleService,
        private permissionService: PermissionService,
        private exportService: ExportService
    ) { }

    private titleCase(name: string) {
        return name
            .trim()
            .split(/\s+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    private scopeConditions(actor: AuthActor, body: RoleListDto, dateCondition: any) {
        if (actor.type === ActorType.ADMIN) {
            const andConditions: any = { ...dateCondition };
            if (body.type) {
                andConditions.type = body.type;
            }
            if (body.vendor_id) {
                andConditions.vendor = { id: body.vendor_id };
            }
            return [andConditions];
        }
        return [
            { ...dateCondition, type: RoleType.VENDOR, vendor: { id: actor.vendor_id } },
            { ...dateCondition, type: RoleType.VENDOR, vendor: IsNull() },
        ];
    }

    private listWhere(actor: AuthActor, body: RoleListDto, dateCondition = dateRangeCondition(body.startDate, body.endDate)) {
        const conditions = this.scopeConditions(actor, body, dateCondition);
        if (!body.search) {
            return conditions;
        }
        return conditions.flatMap((condition) => buildWhere(['name'], body.search, condition));
    }

    private async accessibleRole(actor: AuthActor, id: number, forWrite: boolean): Promise<Role> {
        const role = await this.roleService.findOne({ id }, ['permissions', 'vendor']);
        if (!role) {
            throw new NotFoundException('Role not found');
        }
        if (actor.type === ActorType.CLIENT) {
            const ownRole = role.type === RoleType.VENDOR && role.vendor_id === actor.vendor_id;
            const sharedRole = role.type === RoleType.VENDOR && !role.vendor_id;
            if (!ownRole && !(sharedRole && !forWrite)) {
                throw new ForbiddenException('You do not have access to this role');
            }
        }
        return role;
    }

    private async validPermissions(ids: number[], type: RoleType) {
        const permissionType = type === RoleType.ADMIN ? PermissionType.ADMIN : PermissionType.VENDOR;
        const permissions = await this.permissionService.findByIdsAndType(ids, permissionType);
        if (permissions.length !== (ids || []).length) {
            throw new BadRequestException(`Some permissions are not valid for a ${type} role`);
        }
        return permissions;
    }

    private async assertUniqueName(name: string, type: RoleType, vendorId: number | null, exceptId?: number) {
        const conditions: any[] = [{ name, type, vendor: vendorId ? { id: vendorId } : IsNull() }];
        if (type === RoleType.VENDOR && vendorId) {
            conditions.push({ name, type, is_system: true, vendor: IsNull() });
        }
        const existing = await this.roleService.findOne(conditions.map((condition) => exceptId ? { ...condition, id: Not(exceptId) } : condition));
        if (existing) {
            throw new BadRequestException(`A role with the name "${name}" already exists.`);
        }
    }

    @HasPermission('roles_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor, @Body() body: RoleListDto) {
        const current = this.scopeConditions(actor, body, dateRangeCondition(body.startDate, body.endDate));
        const previous = this.scopeConditions(actor, body, previousDateRangeCondition(body.startDate, body.endDate));
        const totalRoles = await this.roleService.count(current);
        const systemRoles = await this.roleService.count(current.map((condition) => ({ ...condition, is_system: true })));
        const customRoles = totalRoles - systemRoles;
        const previousTotal = body.startDate && body.endDate ? await this.roleService.count(previous) : 0;
        return {
            totalRoles,
            totalRolesGrowth: growth(totalRoles, previousTotal, body.startDate, body.endDate),
            systemRoles,
            customRoles,
        };
    }

    @HasPermission('roles_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: RoleListDto) {
        return this.roleService.paginatedFindByColumns(
            {
                id: true,
                name: true,
                type: true,
                is_system: true,
                created_at: true,
                vendor: { id: true, business_name: true },
            },
            ['vendor'],
            this.listWhere(actor, body),
            body.page || 1,
            body.take || 10,
            sortOrder(body.sortBy),
        );
    }

    @HasPermission('roles_view', 'admins_create', 'admins_edit', 'clients_create', 'clients_edit', 'supervisor_create', 'supervisor_edit')
    @Get('list')
    async dropdown(@Actor() actor: AuthActor, @Query('type') type?: RoleType, @Query('vendor_id') vendorId?: number) {
        let where: any;
        if (actor.type === ActorType.CLIENT) {
            where = this.scopeConditions(actor, {}, {});
        } else if (type === RoleType.VENDOR) {
            where = vendorId
                ? [{ type, vendor: { id: vendorId } }, { type, vendor: IsNull() }]
                : { type, vendor: IsNull() };
        } else {
            where = { type: RoleType.ADMIN };
        }
        const roles = await this.roleService.findByColumns({ id: true, name: true, type: true, is_system: true }, [], where, { name: 'ASC' });
        if (!(await this.roleService.isLimitedGrantor(actor))) {
            return roles;
        }
        const grantable = [];
        for (const role of roles) {
            if (await this.roleService.canGrant(actor, await this.roleService.permissionKeys(role.id))) {
                grantable.push(role);
            }
        }
        return grantable;
    }

    @HasPermission('roles_create')
    @Post()
    async create(@Actor() actor: AuthActor, @Body() body: RoleCreateDto) {
        let type = body.type;
        let vendorId = body.vendor_id || null;
        if (actor.type === ActorType.CLIENT) {
            type = RoleType.VENDOR;
            vendorId = actor.vendor_id;
        }
        if (!type) {
            throw new BadRequestException('type is required');
        }
        if (type === RoleType.ADMIN) {
            vendorId = null;
        }
        const name = this.titleCase(body.name);
        await this.assertUniqueName(name, type, vendorId);
        const permissions = await this.validPermissions(body.permissions, type);
        await this.roleService.assertCanGrant(actor, permissions.map((permission) => permission.permission_key));
        return this.roleService.create({
            name,
            type,
            is_system: false,
            vendor: vendorId ? { id: vendorId } : null,
            permissions,
        });
    }

    @HasPermission('roles_view')
    @Get(':id')
    async get(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.accessibleRole(actor, id, false);
    }

    @HasPermission('roles_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: RoleUpdateDto) {
        const role = await this.accessibleRole(actor, id, true);
        if (role.is_system && role.type === RoleType.ADMIN) {
            throw new BadRequestException('The Super Admin role cannot be changed');
        }
        if (body.name && !role.is_system) {
            role.name = this.titleCase(body.name);
            await this.assertUniqueName(role.name, role.type, role.vendor_id || null, role.id);
        }
        await this.roleService.assertCanManageRole(actor, role.id);
        if (body.permissions) {
            role.permissions = await this.validPermissions(body.permissions, role.type);
            await this.roleService.assertCanGrant(actor, role.permissions.map((permission) => permission.permission_key));
        }
        await this.roleService.create(role);
        this.roleService.clearPermissionCache(role.id);
        return this.accessibleRole(actor, id, false);
    }

    @HasPermission('roles_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        const role = await this.accessibleRole(actor, id, true);
        if (role.is_system) {
            throw new BadRequestException('System roles cannot be deleted');
        }
        await this.roleService.assertCanManageRole(actor, role.id);
        const assigned = await this.roleService.assignedCount(role.id);
        if (assigned.active > 0) {
            throw new BadRequestException(`This role is assigned to ${assigned.active} account(s). Reassign them before deleting.`);
        }
        if (assigned.deleted > 0) {
            throw new BadRequestException(`This role was used by ${assigned.deleted} deleted account(s), so it cannot be removed. Rename it or leave it unused instead.`);
        }
        await this.roleService.delete(role.id);
        this.roleService.clearPermissionCache(role.id);
        return { message: 'Success' };
    }

    @HasPermission('roles_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: RoleListDto, @Res() res: Response) {
        const response = await this.roleService.paginatedFindByColumns({}, ['vendor'], this.listWhere(actor, body), 1, 100000, sortOrder(body.sortBy));
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Type', key: 'type', width: 15 },
            { header: 'Vendor', key: 'vendor', width: 25, value: (row: any) => row.vendor?.business_name },
            { header: 'System', key: 'is_system', width: 12, value: (row: any) => (row.is_system ? 'Yes' : 'No') },
            { header: 'Created At', key: 'created_at', width: 22 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Roles', columns, response.data);
        }
        return this.exportService.excel(res, 'Roles', columns, response.data);
    }
}
