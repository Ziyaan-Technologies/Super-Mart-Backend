import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Res } from '@nestjs/common';
import { Response } from 'express';
import { Not } from 'typeorm';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { activeStatusCondition, buildWhere, dateRangeCondition, growth, previousDateRangeCondition, sortOrder } from 'src/common/list-query';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { VendorService } from './vendor.service';
import { VendorCreateDto, VendorListDto, VendorProfileUpdateDto, VendorUpdateDto } from './models/vendor.dto';

@Controller('vendors')
export class VendorController {
    constructor(
        private vendorService: VendorService,
        private exportService: ExportService
    ) { }

    private andConditions(body: VendorListDto, dateCondition: any) {
        const andConditions: any = { ...dateCondition, ...activeStatusCondition(body.status) };
        if (body.business_type) {
            andConditions.business_type = body.business_type;
        }
        if (body.country_id) {
            andConditions.country = { id: body.country_id };
        }
        return andConditions;
    }

    private listWhere(body: VendorListDto) {
        return buildWhere(['business_name', 'owner_name', 'email', 'phone'], body.search, this.andConditions(body, dateRangeCondition(body.startDate, body.endDate)));
    }

    private relations(data: any) {
        const { country_id, city_id, ...rest } = data;
        return {
            ...rest,
            ...(country_id !== undefined ? { country: { id: country_id } } : {}),
            ...(city_id !== undefined ? { city: city_id ? { id: city_id } : null } : {}),
        };
    }

    @ActorTypes(ActorType.CLIENT)
    @Get('me')
    async me(@Actor() actor: AuthActor) {
        return this.vendorService.findOne({ id: actor.vendor_id }, ['country', 'city']);
    }

    @ActorTypes(ActorType.CLIENT)
    @HasPermission('store_edit')
    @Put('me')
    async updateMe(@Actor() actor: AuthActor, @Body() body: VendorProfileUpdateDto) {
        const changes = this.relations(body);
        if (Object.keys(changes).length) {
            await this.vendorService.update(actor.vendor_id, changes);
        }
        return this.me(actor);
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('vendors_view')
    @Post('v1/kpis')
    async kpis(@Body() body: VendorListDto) {
        const current = this.andConditions(body, dateRangeCondition(body.startDate, body.endDate));
        const previous = this.andConditions(body, previousDateRangeCondition(body.startDate, body.endDate));
        const totalVendors = await this.vendorService.count(current);
        const activeVendors = await this.vendorService.count({ ...current, is_active: true });
        const inactiveVendors = await this.vendorService.count({ ...current, is_active: false });
        const previousTotal = body.startDate && body.endDate ? await this.vendorService.count(previous) : 0;
        return {
            totalVendors,
            totalVendorsGrowth: growth(totalVendors, previousTotal, body.startDate, body.endDate),
            activeVendors,
            inactiveVendors,
        };
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('vendors_view')
    @Post('v1/list')
    async list(@Body() body: VendorListDto) {
        return this.vendorService.paginatedFindByColumns({}, ['country', 'city'], this.listWhere(body), body.page || 1, body.take || 10, sortOrder(body.sortBy));
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('vendors_view', 'client_stores_view', 'client_stores_create', 'clients_view', 'clients_create', 'roles_view', 'customers_view', 'products_view', 'stock_view', 'categories_view', 'brands_view')
    @Get('list')
    async dropdown() {
        return this.vendorService.findByColumns({ id: true, business_name: true, business_type: true }, [], { is_active: true }, { business_name: 'ASC' });
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('vendors_create')
    @Post()
    async create(@Body() body: VendorCreateDto) {
        const existing = await this.vendorService.findOne({ email: body.email });
        if (existing) {
            throw new BadRequestException('A vendor with this email already exists');
        }
        const vendor = await this.vendorService.createWithOwner(body);
        return this.get(vendor.id);
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('vendors_view')
    @Get(':id')
    async get(@Param('id') id: number) {
        const vendor = await this.vendorService.findOne({ id }, ['country', 'city', 'clientstores']);
        if (!vendor) {
            throw new NotFoundException('Vendor not found');
        }
        return vendor;
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('vendors_edit')
    @Put(':id')
    async update(@Param('id') id: number, @Body() body: VendorUpdateDto) {
        await this.get(id);
        if (body.email) {
            const existing = await this.vendorService.findOne({ email: body.email, id: Not(id) });
            if (existing) {
                throw new BadRequestException('A vendor with this email already exists');
            }
        }
        const changes = this.relations(body);
        if (Object.keys(changes).length) {
            await this.vendorService.update(id, changes);
        }
        return this.get(id);
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('vendors_delete')
    @Delete(':id')
    async delete(@Param('id') id: number) {
        await this.get(id);
        return this.vendorService.softDelete(id);
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('vendors_view')
    @Post('export/:format')
    async export(@Param('format') format: string, @Body() body: VendorListDto, @Res() res: Response) {
        const response = await this.vendorService.paginatedFindByColumns({}, ['country', 'city'], this.listWhere(body), 1, 100000, sortOrder(body.sortBy));
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Business', key: 'business_name', width: 28 },
            { header: 'Owner', key: 'owner_name', width: 22 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Phone', key: 'phone', width: 18 },
            { header: 'Type', key: 'business_type', width: 18 },
            { header: 'Country', key: 'country', width: 18, value: (row: any) => row.country?.name },
            { header: 'Status', key: 'is_active', width: 12 },
            { header: 'Created At', key: 'created_at', width: 22 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Vendors', columns, response.data);
        }
        return this.exportService.excel(res, 'Vendors', columns, response.data);
    }
}
