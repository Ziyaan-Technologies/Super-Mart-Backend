import { BadRequestException, Body, ClassSerializerInterceptor, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Res, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { activeStatusCondition, buildWhere, dateRangeCondition, growth, previousDateRangeCondition, sortOrder } from 'src/common/list-query';
import { requiredVendorId, scopedClientstoreId, scopedVendorId } from 'src/common/tenant-scope';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ClientstoreService } from 'src/clientstore/clientstore.service';
import { RoleService } from 'src/role/role.service';
import { ClientService } from './client.service';
import { ClientType } from './models/client.entity';
import { ClientCreateDto, ClientListDto, ClientUpdateDto } from './models/client.dto';

@UseInterceptors(ClassSerializerInterceptor)
@ActorTypes(ActorType.ADMIN, ActorType.CLIENT)
@Controller('clients')
export class ClientController {
    constructor(
        private clientService: ClientService,
        private clientstoreService: ClientstoreService,
        private roleService: RoleService,
        private exportService: ExportService
    ) { }

    private andConditions(actor: AuthActor, body: ClientListDto, dateCondition: any) {
        const andConditions: any = { ...dateCondition, ...activeStatusCondition(body.status) };
        const vendorId = scopedVendorId(actor, body.vendor_id);
        if (vendorId) {
            andConditions.vendor = { id: vendorId };
        }
        const clientstoreId = scopedClientstoreId(actor, body.clientstore_id);
        if (clientstoreId) {
            andConditions.clientstore = { id: clientstoreId };
        }
        if (body.client_type) {
            andConditions.client_type = body.client_type;
        }
        if (body.role_id) {
            andConditions.role = { id: body.role_id };
        }
        return andConditions;
    }

    private listWhere(actor: AuthActor, body: ClientListDto) {
        return buildWhere(['full_name', 'email', 'phone'], body.search, this.andConditions(actor, body, dateRangeCondition(body.startDate, body.endDate)));
    }

    private relations(data: any) {
        const { vendor_id, clientstore_id, role_id, country_id, city_id, ...rest } = data;
        return {
            ...rest,
            ...(clientstore_id !== undefined ? { clientstore: clientstore_id ? { id: clientstore_id } : null } : {}),
            ...(role_id !== undefined ? { role: { id: role_id } } : {}),
            ...(country_id !== undefined ? { country: country_id ? { id: country_id } : null } : {}),
            ...(city_id !== undefined ? { city: city_id ? { id: city_id } : null } : {}),
        };
    }

    private async resolveClientstore(actor: AuthActor, vendorId: number, requested?: number | null) {
        if (actor.type === ActorType.CLIENT && actor.clientstore_id) {
            return actor.clientstore_id;
        }
        if (requested) {
            await this.clientstoreService.assertBelongsToVendor(requested, vendorId);
            return requested;
        }
        return null;
    }

    @HasPermission('clients_view', 'supervisor_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor, @Body() body: ClientListDto) {
        const current = this.andConditions(actor, body, dateRangeCondition(body.startDate, body.endDate));
        const previous = this.andConditions(actor, body, previousDateRangeCondition(body.startDate, body.endDate));
        const totalClients = await this.clientService.count(current);
        const activeClients = await this.clientService.count({ ...current, is_active: true });
        const owners = await this.clientService.count({ ...current, client_type: ClientType.OWNER });
        const supervisors = await this.clientService.count({ ...current, client_type: ClientType.SUPERVISOR });
        const previousTotal = body.startDate && body.endDate ? await this.clientService.count(previous) : 0;
        return {
            totalClients,
            totalClientsGrowth: growth(totalClients, previousTotal, body.startDate, body.endDate),
            activeClients,
            owners,
            supervisors,
        };
    }

    @HasPermission('clients_view', 'supervisor_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: ClientListDto) {
        return this.clientService.paginatedFindByColumns(
            {},
            ['vendor', 'clientstore', 'role'],
            this.listWhere(actor, body),
            body.page || 1,
            body.take || 10,
            sortOrder(body.sortBy),
        );
    }

    @HasPermission('clients_create', 'supervisor_create')
    @Post()
    async create(@Actor() actor: AuthActor, @Body() body: ClientCreateDto) {
        const vendorId = requiredVendorId(actor, body.vendor_id);
        const clientType = actor.type === ActorType.ADMIN ? body.client_type || ClientType.SUPERVISOR : ClientType.SUPERVISOR;
        await this.clientService.assertUnique(body.email, body.phone);
        await this.clientService.assertVendorRole(body.role_id, vendorId);
        await this.roleService.assertCanManageRole(actor, body.role_id);
        const clientstoreId = await this.resolveClientstore(actor, vendorId, body.clientstore_id);
        const client = await this.clientService.create({
            ...this.relations({ ...body, clientstore_id: clientType === ClientType.OWNER ? null : clientstoreId }),
            client_type: clientType,
            password: await bcrypt.hash(body.password, 12),
            vendor: { id: vendorId },
        });
        return this.get(actor, client.id);
    }

    @HasPermission('clients_view', 'supervisor_view')
    @Get(':id')
    async get(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.clientService.accessible(actor, id, ['vendor', 'clientstore', 'role', 'country', 'city']);
    }

    @HasPermission('clients_edit', 'supervisor_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ClientUpdateDto) {
        const client = await this.clientService.accessible(actor, id);
        if (actor.type === ActorType.CLIENT && this.clientService.isOwner(client)) {
            throw new ForbiddenException('The business owner account can only be changed from the profile page');
        }
        if (actor.type === ActorType.CLIENT && client.id === actor.id && (body.role_id || body.is_active === false || body.clientstore_id !== undefined)) {
            throw new ForbiddenException('You cannot change your own role, store or status');
        }
        if (client.id !== actor.id) {
            await this.roleService.assertCanManageRole(actor, client.role_id);
        }
        await this.clientService.assertUnique(body.email, body.phone, client.id);
        if (body.role_id) {
            await this.clientService.assertVendorRole(body.role_id, client.vendor_id);
            await this.roleService.assertCanManageRole(actor, body.role_id);
        }
        const data: any = { ...body };
        if (body.clientstore_id !== undefined) {
            data.clientstore_id = this.clientService.isOwner(client) ? null : await this.resolveClientstore(actor, client.vendor_id, body.clientstore_id);
        }
        if (body.password) {
            data.password = await bcrypt.hash(body.password, 12);
        } else {
            delete data.password;
        }
        const changes = this.relations(data);
        if (Object.keys(changes).length) {
            await this.clientService.update(client.id, changes);
        }
        if (body.password) {
            await this.clientService.increment({ id: client.id }, 'token_version', 1);
        }
        return this.get(actor, client.id);
    }

    @HasPermission('clients_delete', 'supervisor_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        const client = await this.clientService.accessible(actor, id);
        if (actor.type === ActorType.CLIENT && client.id === actor.id) {
            throw new BadRequestException('You cannot delete your own account');
        }
        await this.roleService.assertCanManageRole(actor, client.role_id);
        if (this.clientService.isOwner(client)) {
            const owners = await this.clientService.count({ vendor: { id: client.vendor_id }, client_type: ClientType.OWNER });
            if (actor.type === ActorType.CLIENT || owners <= 1) {
                throw new BadRequestException('The last business owner account cannot be deleted');
            }
        }
        return this.clientService.softDelete(client.id);
    }

    @HasPermission('clients_view', 'supervisor_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: ClientListDto, @Res() res: Response) {
        const response = await this.clientService.paginatedFindByColumns({}, ['vendor', 'clientstore', 'role'], this.listWhere(actor, body), 1, 100000, sortOrder(body.sortBy));
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'full_name', width: 25 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Phone', key: 'phone', width: 18 },
            { header: 'Type', key: 'client_type', width: 14 },
            { header: 'Vendor', key: 'vendor', width: 22, value: (row: any) => row.vendor?.business_name },
            { header: 'Store', key: 'clientstore', width: 22, value: (row: any) => row.clientstore?.store_name },
            { header: 'Role', key: 'role', width: 18, value: (row: any) => row.role?.name },
            { header: 'Status', key: 'is_active', width: 12 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Staff', columns, response.data);
        }
        return this.exportService.excel(res, 'Staff', columns, response.data);
    }
}
