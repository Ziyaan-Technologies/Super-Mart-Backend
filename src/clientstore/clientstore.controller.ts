import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Not } from 'typeorm';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { activeStatusCondition, buildWhere, dateRangeCondition, growth, previousDateRangeCondition, sortOrder } from 'src/common/list-query';
import { requiredVendorId, scopedVendorId } from 'src/common/tenant-scope';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ClientstoreService } from './clientstore.service';
import { ClientstoreCreateDto, ClientstoreListDto, ClientstoreUpdateDto } from './models/clientstore.dto';

@ActorTypes(ActorType.ADMIN, ActorType.CLIENT)
@Controller('clientstores')
export class ClientstoreController {
    constructor(
        private clientstoreService: ClientstoreService,
        private exportService: ExportService
    ) { }

    private andConditions(actor: AuthActor, body: ClientstoreListDto, dateCondition: any) {
        const andConditions: any = { ...dateCondition, ...activeStatusCondition(body.status) };
        const vendorId = scopedVendorId(actor, body.vendor_id);
        if (vendorId) {
            andConditions.vendor = { id: vendorId };
        }
        if (actor.type === ActorType.CLIENT && actor.clientstore_id) {
            andConditions.id = actor.clientstore_id;
        }
        if (body.city_id) {
            andConditions.city = { id: body.city_id };
        }
        return andConditions;
    }

    private listWhere(actor: AuthActor, body: ClientstoreListDto) {
        return buildWhere(['store_name', 'store_code', 'store_phone', 'address'], body.search, this.andConditions(actor, body, dateRangeCondition(body.startDate, body.endDate)));
    }

    private relations(data: any) {
        const { vendor_id, country_id, city_id, area_id, ...rest } = data;
        return {
            ...rest,
            ...(country_id !== undefined ? { country: { id: country_id } } : {}),
            ...(city_id !== undefined ? { city: { id: city_id } } : {}),
            ...(area_id !== undefined ? { area: area_id ? { id: area_id } : null } : {}),
        };
    }

    private async assertUniqueCode(vendorId: number, storeCode: string, exceptId?: number) {
        const condition: any = { vendor: { id: vendorId }, store_code: storeCode };
        if (exceptId) {
            condition.id = Not(exceptId);
        }
        if (await this.clientstoreService.findOne(condition)) {
            throw new BadRequestException(`Store code "${storeCode}" is already used`);
        }
    }

    @HasPermission('client_stores_view', 'store_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor, @Body() body: ClientstoreListDto) {
        const current = this.andConditions(actor, body, dateRangeCondition(body.startDate, body.endDate));
        const previous = this.andConditions(actor, body, previousDateRangeCondition(body.startDate, body.endDate));
        const totalStores = await this.clientstoreService.count(current);
        const activeStores = await this.clientstoreService.count({ ...current, is_active: true });
        const inactiveStores = await this.clientstoreService.count({ ...current, is_active: false });
        const posStores = await this.clientstoreService.count({ ...current, is_pos_active: true });
        const previousTotal = body.startDate && body.endDate ? await this.clientstoreService.count(previous) : 0;
        return {
            totalStores,
            totalStoresGrowth: growth(totalStores, previousTotal, body.startDate, body.endDate),
            activeStores,
            inactiveStores,
            posStores,
        };
    }

    @HasPermission('client_stores_view', 'store_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: ClientstoreListDto) {
        return this.clientstoreService.paginatedFindByColumns(
            {},
            ['vendor', 'country', 'city', 'area'],
            this.listWhere(actor, body),
            body.page || 1,
            body.take || 10,
            sortOrder(body.sortBy),
        );
    }

    @Get('list')
    async dropdown(@Actor() actor: AuthActor, @Query('vendor_id') vendorId?: number) {
        const where: any = { is_active: true };
        const scopedId = scopedVendorId(actor, vendorId);
        if (scopedId) {
            where.vendor = { id: scopedId };
        }
        if (actor.type === ActorType.CLIENT && actor.clientstore_id) {
            where.id = actor.clientstore_id;
        }
        return this.clientstoreService.findByColumns(
            { id: true, store_name: true, store_code: true, image_url: true, address: true, is_pos_active: true, vendor: { id: true, business_name: true }, city: { id: true, name: true } },
            ['vendor', 'city'],
            where,
            { store_name: 'ASC' },
        );
    }

    @ActorTypes(ActorType.CLIENT)
    @Get('directory')
    async directory(@Actor() actor: AuthActor) {
        return this.clientstoreService.findByColumns(
            { id: true, store_name: true, store_code: true },
            [],
            { vendor: { id: actor.vendor_id }, is_active: true },
            { store_name: 'ASC' },
        );
    }

    @HasPermission('client_stores_create', 'store_create')
    @Post()
    async create(@Actor() actor: AuthActor, @Body() body: ClientstoreCreateDto) {
        if (actor.type === ActorType.CLIENT && actor.clientstore_id) {
            throw new ForbiddenException('Store staff cannot create new stores');
        }
        const vendorId = requiredVendorId(actor, body.vendor_id);
        await this.assertUniqueCode(vendorId, body.store_code);
        const clientstore = await this.clientstoreService.create({
            ...this.relations(body),
            vendor: { id: vendorId },
        });
        return this.get(actor, clientstore.id);
    }

    @Get(':id')
    async get(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.clientstoreService.accessible(actor, id, ['vendor', 'country', 'city', 'area']);
    }

    @HasPermission('client_stores_edit', 'store_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ClientstoreUpdateDto) {
        const clientstore = await this.clientstoreService.accessible(actor, id);
        if (body.store_code) {
            await this.assertUniqueCode(clientstore.vendor_id, body.store_code, clientstore.id);
        }
        const changes = this.relations(body);
        if (Object.keys(changes).length) {
            await this.clientstoreService.update(id, changes);
        }
        return this.get(actor, id);
    }

    @HasPermission('client_stores_delete', 'store_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        if (actor.type === ActorType.CLIENT && actor.clientstore_id) {
            throw new ForbiddenException('Store staff cannot delete stores');
        }
        await this.clientstoreService.accessible(actor, id);
        return this.clientstoreService.softDelete(id);
    }

    @HasPermission('client_stores_view', 'store_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: ClientstoreListDto, @Res() res: Response) {
        const response = await this.clientstoreService.paginatedFindByColumns({}, ['vendor', 'city'], this.listWhere(actor, body), 1, 100000, sortOrder(body.sortBy));
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Store', key: 'store_name', width: 28 },
            { header: 'Code', key: 'store_code', width: 12 },
            { header: 'Vendor', key: 'vendor', width: 25, value: (row: any) => row.vendor?.business_name },
            { header: 'City', key: 'city', width: 18, value: (row: any) => row.city?.name },
            { header: 'Phone', key: 'store_phone', width: 18 },
            { header: 'Status', key: 'is_active', width: 12 },
            { header: 'Created At', key: 'created_at', width: 22 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Stores', columns, response.data);
        }
        return this.exportService.excel(res, 'Stores', columns, response.data);
    }
}
