import { Body, ClassSerializerInterceptor, Controller, Delete, Get, Param, Post, Put, Res, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { activeStatusCondition, buildWhere, dateRangeCondition, growth, previousDateRangeCondition, sortOrder } from 'src/common/list-query';
import { requiredVendorId, scopedVendorId } from 'src/common/tenant-scope';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { UserService } from './user.service';
import { UserCreateDto, UserListDto, UserUpdateDto } from './models/user.dto';

@UseInterceptors(ClassSerializerInterceptor)
@ActorTypes(ActorType.ADMIN, ActorType.CLIENT)
@Controller('users')
export class UserController {
    constructor(
        private userService: UserService,
        private exportService: ExportService
    ) { }

    private andConditions(actor: AuthActor, body: UserListDto, dateCondition: any) {
        const andConditions: any = { ...dateCondition, ...activeStatusCondition(body.status) };
        const vendorId = scopedVendorId(actor, body.vendor_id);
        if (vendorId) {
            andConditions.vendor = { id: vendorId };
        }
        if (body.city_id) {
            andConditions.city = { id: body.city_id };
        }
        return andConditions;
    }

    private listWhere(actor: AuthActor, body: UserListDto) {
        return buildWhere(['full_name', 'email', 'phone'], body.search, this.andConditions(actor, body, dateRangeCondition(body.startDate, body.endDate)));
    }

    private relations(data: any) {
        const { vendor_id, city_id, ...rest } = data;
        return {
            ...rest,
            ...(city_id !== undefined ? { city: city_id ? { id: city_id } : null } : {}),
        };
    }

    @HasPermission('customers_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor, @Body() body: UserListDto) {
        const current = this.andConditions(actor, body, dateRangeCondition(body.startDate, body.endDate));
        const previous = this.andConditions(actor, body, previousDateRangeCondition(body.startDate, body.endDate));
        const totalCustomers = await this.userService.count(current);
        const activeCustomers = await this.userService.count({ ...current, is_active: true });
        const inactiveCustomers = await this.userService.count({ ...current, is_active: false });
        const previousTotal = body.startDate && body.endDate ? await this.userService.count(previous) : 0;
        return {
            totalCustomers,
            totalCustomersGrowth: growth(totalCustomers, previousTotal, body.startDate, body.endDate),
            activeCustomers,
            inactiveCustomers,
        };
    }

    @HasPermission('customers_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: UserListDto) {
        return this.userService.paginatedFindByColumns({}, ['vendor', 'city'], this.listWhere(actor, body), body.page || 1, body.take || 10, sortOrder(body.sortBy));
    }

    @HasPermission('customers_create')
    @Post()
    async create(@Actor() actor: AuthActor, @Body() body: UserCreateDto) {
        const vendorId = requiredVendorId(actor, body.vendor_id);
        await this.userService.assertUnique(vendorId, body.email, body.phone);
        const user = await this.userService.create({
            ...this.relations(body),
            password: body.password ? await bcrypt.hash(body.password, 12) : null,
            vendor: { id: vendorId },
        });
        return this.get(actor, user.id);
    }

    @HasPermission('customers_view')
    @Get(':id')
    async get(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.userService.accessible(actor, id, ['vendor', 'city']);
    }

    @HasPermission('customers_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: UserUpdateDto) {
        const user = await this.userService.accessible(actor, id);
        await this.userService.assertUnique(user.vendor_id, body.email, body.phone, user.id);
        const data: any = { ...body };
        if (body.password) {
            data.password = await bcrypt.hash(body.password, 12);
        } else {
            delete data.password;
        }
        const changes = this.relations(data);
        if (Object.keys(changes).length) {
            await this.userService.update(user.id, changes);
        }
        if (body.password) {
            await this.userService.increment({ id: user.id }, 'token_version', 1);
        }
        return this.get(actor, user.id);
    }

    @HasPermission('customers_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        const user = await this.userService.accessible(actor, id);
        return this.userService.softDelete(user.id);
    }

    @HasPermission('customers_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: UserListDto, @Res() res: Response) {
        const response = await this.userService.paginatedFindByColumns({}, ['vendor', 'city'], this.listWhere(actor, body), 1, 100000, sortOrder(body.sortBy));
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'full_name', width: 25 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Phone', key: 'phone', width: 18 },
            { header: 'Vendor', key: 'vendor', width: 22, value: (row: any) => row.vendor?.business_name },
            { header: 'City', key: 'city', width: 18, value: (row: any) => row.city?.name },
            { header: 'Status', key: 'is_active', width: 12 },
            { header: 'Created At', key: 'created_at', width: 22 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Customers', columns, response.data);
        }
        return this.exportService.excel(res, 'Customers', columns, response.data);
    }
}
