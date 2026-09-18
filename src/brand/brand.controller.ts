import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { activeStatusCondition, buildWhere, dateRangeCondition, growth, previousDateRangeCondition, sortOrder, VendorScopedListDto } from 'src/common/list-query';
import { requiredVendorId, scopedVendorId } from 'src/common/tenant-scope';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { BrandService } from './brand.service';
import { BrandCreateDto, BrandUpdateDto } from './models/brand.dto';

@ActorTypes(ActorType.ADMIN, ActorType.CLIENT)
@Controller('brands')
export class BrandController {
    constructor(
        private brandService: BrandService,
        private exportService: ExportService
    ) { }

    private andConditions(actor: AuthActor, body: VendorScopedListDto, dateCondition: any) {
        const andConditions: any = { ...dateCondition, ...activeStatusCondition(body.status) };
        const vendorId = scopedVendorId(actor, body.vendor_id);
        if (vendorId) {
            andConditions.vendor = { id: vendorId };
        }
        return andConditions;
    }

    private listWhere(actor: AuthActor, body: VendorScopedListDto) {
        return buildWhere(['name', 'description'], body.search, this.andConditions(actor, body, dateRangeCondition(body.startDate, body.endDate)));
    }

    @HasPermission('brands_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor, @Body() body: VendorScopedListDto) {
        const current = this.andConditions(actor, body, dateRangeCondition(body.startDate, body.endDate));
        const previous = this.andConditions(actor, body, previousDateRangeCondition(body.startDate, body.endDate));
        const totalBrands = await this.brandService.count(current);
        const activeBrands = await this.brandService.count({ ...current, is_active: true });
        const inactiveBrands = await this.brandService.count({ ...current, is_active: false });
        const previousTotal = body.startDate && body.endDate ? await this.brandService.count(previous) : 0;
        return {
            totalBrands,
            totalBrandsGrowth: growth(totalBrands, previousTotal, body.startDate, body.endDate),
            activeBrands,
            inactiveBrands,
        };
    }

    @HasPermission('brands_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: VendorScopedListDto) {
        return this.brandService.paginatedFindByColumns({}, ['vendor'], this.listWhere(actor, body), body.page || 1, body.take || 10, sortOrder(body.sortBy));
    }

    @Get('list')
    async dropdown(@Actor() actor: AuthActor, @Query('vendor_id') vendorId?: number) {
        const where: any = { is_active: true };
        const scopedId = scopedVendorId(actor, vendorId);
        if (scopedId) {
            where.vendor = { id: scopedId };
        }
        return this.brandService.findByColumns({ id: true, name: true, image_url: true }, [], where, { name: 'ASC' });
    }

    @HasPermission('brands_create')
    @Post()
    async create(@Actor() actor: AuthActor, @Body() body: BrandCreateDto) {
        const vendorId = requiredVendorId(actor, body.vendor_id);
        await this.brandService.assertUniqueName(vendorId, body.name);
        const { vendor_id, ...data } = body;
        const brand = await this.brandService.create({ ...data, vendor: { id: vendorId } });
        return this.get(actor, brand.id);
    }

    @HasPermission('brands_view')
    @Get(':id')
    async get(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.brandService.accessible(actor, id, ['vendor']);
    }

    @HasPermission('brands_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: BrandUpdateDto) {
        const brand = await this.brandService.accessible(actor, id);
        await this.brandService.assertUniqueName(brand.vendor_id, body.name, brand.id);
        const { vendor_id, ...data } = body;
        if (Object.keys(data).length) {
            await this.brandService.update(brand.id, data);
        }
        return this.get(actor, brand.id);
    }

    @HasPermission('brands_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        const brand = await this.brandService.accessible(actor, id);
        if (await this.brandService.usageCount(brand.id)) {
            throw new BadRequestException('This brand is used by products and cannot be deleted');
        }
        return this.brandService.softDelete(brand.id);
    }

    @HasPermission('brands_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: VendorScopedListDto, @Res() res: Response) {
        const response = await this.brandService.paginatedFindByColumns({}, ['vendor'], this.listWhere(actor, body), 1, 100000, sortOrder(body.sortBy));
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Vendor', key: 'vendor', width: 25, value: (row: any) => row.vendor?.business_name },
            { header: 'Description', key: 'description', width: 35 },
            { header: 'Status', key: 'is_active', width: 12 },
            { header: 'Created At', key: 'created_at', width: 22 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Brands', columns, response.data);
        }
        return this.exportService.excel(res, 'Brands', columns, response.data);
    }
}
