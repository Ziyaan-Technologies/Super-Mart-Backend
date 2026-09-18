import { BadRequestException, Body, ClassSerializerInterceptor, Controller, Delete, Get, NotFoundException, Param, Post, Put, Res, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { Not } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { activeStatusCondition, buildWhere, dateRangeCondition, growth, previousDateRangeCondition, sortOrder } from 'src/common/list-query';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { RoleService } from 'src/role/role.service';
import { RoleType } from 'src/role/role.entity';
import { AdminService } from './admin.service';
import { AdminCreateDto, AdminListDto, AdminUpdateDto } from './models/admin.dto';

@UseInterceptors(ClassSerializerInterceptor)
@ActorTypes(ActorType.ADMIN)
@Controller('admins')
export class AdminController {
    constructor(
        private adminService: AdminService,
        private roleService: RoleService,
        private exportService: ExportService
    ) { }

    private andConditions(body: AdminListDto, dateCondition: any) {
        const andConditions: any = { ...dateCondition, ...activeStatusCondition(body.status) };
        if (body.role_id) {
            andConditions.role = { id: body.role_id };
        }
        return andConditions;
    }

    private listWhere(body: AdminListDto) {
        return buildWhere(['full_name', 'email', 'phone'], body.search, this.andConditions(body, dateRangeCondition(body.startDate, body.endDate)));
    }

    private async assertUnique(email?: string, phone?: string, exceptId?: number) {
        const conditions: any[] = [];
        if (email) conditions.push({ email });
        if (phone) conditions.push({ phone });
        if (!conditions.length) return;
        const existing = await this.adminService.findOne(conditions.map((condition) => exceptId ? { ...condition, id: Not(exceptId) } : condition));
        if (existing) {
            throw new BadRequestException(existing.email === email ? 'Email address already exists' : 'Phone number already exists');
        }
    }

    private async assertAdminRole(roleId: number) {
        const role = await this.roleService.findOne({ id: roleId });
        if (!role || role.type !== RoleType.ADMIN) {
            throw new BadRequestException('Please choose a valid admin role');
        }
    }

    private relations(data: any) {
        const { role_id, country_id, city_id, ...rest } = data;
        return {
            ...rest,
            ...(role_id !== undefined ? { role: { id: role_id } } : {}),
            ...(country_id !== undefined ? { country: country_id ? { id: country_id } : null } : {}),
            ...(city_id !== undefined ? { city: city_id ? { id: city_id } : null } : {}),
        };
    }

    @HasPermission('admins_view')
    @Post('v1/kpis')
    async kpis(@Body() body: AdminListDto) {
        const current = this.andConditions(body, dateRangeCondition(body.startDate, body.endDate));
        const previous = this.andConditions(body, previousDateRangeCondition(body.startDate, body.endDate));
        const totalAdmins = await this.adminService.count(current);
        const activeAdmins = await this.adminService.count({ ...current, is_active: true });
        const inactiveAdmins = await this.adminService.count({ ...current, is_active: false });
        const previousTotal = body.startDate && body.endDate ? await this.adminService.count(previous) : 0;
        return {
            totalAdmins,
            totalAdminsGrowth: growth(totalAdmins, previousTotal, body.startDate, body.endDate),
            activeAdmins,
            inactiveAdmins,
        };
    }

    @HasPermission('admins_view')
    @Post('v1/list')
    async list(@Body() body: AdminListDto) {
        return this.adminService.paginatedFindByColumns(
            {},
            ['role', 'country', 'city'],
            this.listWhere(body),
            body.page || 1,
            body.take || 10,
            sortOrder(body.sortBy),
        );
    }

    @HasPermission('admins_create')
    @Post()
    async create(@Body() body: AdminCreateDto) {
        await this.assertUnique(body.email, body.phone);
        await this.assertAdminRole(body.role_id);
        const admin = await this.adminService.create(this.relations({
            ...body,
            password: await bcrypt.hash(body.password, 12),
        }));
        return this.get(admin.id);
    }

    @HasPermission('admins_view')
    @Get(':id')
    async get(@Param('id') id: number) {
        const admin = await this.adminService.findOne({ id }, ['role', 'country', 'city']);
        if (!admin) {
            throw new NotFoundException('Admin not found');
        }
        return admin;
    }

    @HasPermission('admins_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: AdminUpdateDto) {
        await this.get(id);
        await this.assertUnique(body.email, body.phone, id);
        if (body.role_id) {
            await this.assertAdminRole(body.role_id);
        }
        if (Number(id) === actor.id && body.is_active === false) {
            throw new BadRequestException('You cannot deactivate your own account');
        }
        const data: any = { ...body };
        if (body.password) {
            data.password = await bcrypt.hash(body.password, 12);
        } else {
            delete data.password;
        }
        const changes = this.relations(data);
        if (Object.keys(changes).length) {
            await this.adminService.update(id, changes);
        }
        if (body.password) {
            await this.adminService.increment({ id }, 'token_version', 1);
        }
        return this.get(id);
    }

    @HasPermission('admins_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        if (Number(id) === actor.id) {
            throw new BadRequestException('You cannot delete your own account');
        }
        await this.get(id);
        return this.adminService.softDelete(id);
    }

    @HasPermission('admins_view')
    @Post('export/:format')
    async export(@Param('format') format: string, @Body() body: AdminListDto, @Res() res: Response) {
        const response = await this.adminService.paginatedFindByColumns({}, ['role'], this.listWhere(body), 1, 100000, sortOrder(body.sortBy));
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'full_name', width: 25 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Phone', key: 'phone', width: 18 },
            { header: 'Role', key: 'role', width: 20, value: (row: any) => row.role?.name },
            { header: 'Status', key: 'is_active', width: 12 },
            { header: 'Created At', key: 'created_at', width: 22 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Admins', columns, response.data);
        }
        return this.exportService.excel(res, 'Admins', columns, response.data);
    }
}
