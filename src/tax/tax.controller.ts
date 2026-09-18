import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { activeStatusCondition, buildWhere, dateRangeCondition, growth, previousDateRangeCondition, sortOrder, VendorScopedListDto } from 'src/common/list-query';
import { requiredVendorId, scopedVendorId } from 'src/common/tenant-scope';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { TaxService } from './tax.service';
import { TaxCreateDto, TaxUpdateDto } from './models/tax.dto';

@ActorTypes(ActorType.ADMIN, ActorType.CLIENT)
@Controller('taxes')
export class TaxController {
    constructor(
        private taxService: TaxService,
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
        return buildWhere(['name'], body.search, this.andConditions(actor, body, dateRangeCondition(body.startDate, body.endDate)));
    }

    @HasPermission('taxes_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor, @Body() body: VendorScopedListDto) {
        const current = this.andConditions(actor, body, dateRangeCondition(body.startDate, body.endDate));
        const previous = this.andConditions(actor, body, previousDateRangeCondition(body.startDate, body.endDate));
        const totalTaxes = await this.taxService.count(current);
        const activeTaxes = await this.taxService.count({ ...current, is_active: true });
        const inactiveTaxes = await this.taxService.count({ ...current, is_active: false });
        const previousTotal = body.startDate && body.endDate ? await this.taxService.count(previous) : 0;
        return {
            totalTaxes,
            totalTaxesGrowth: growth(totalTaxes, previousTotal, body.startDate, body.endDate),
            activeTaxes,
            inactiveTaxes,
        };
    }

    @HasPermission('taxes_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: VendorScopedListDto) {
        return this.taxService.paginatedFindByColumns({}, ['vendor'], this.listWhere(actor, body), body.page || 1, body.take || 10, sortOrder(body.sortBy));
    }

    @Get('list')
    async dropdown(@Actor() actor: AuthActor, @Query('vendor_id') vendorId?: number) {
        const where: any = { is_active: true };
        const scopedId = scopedVendorId(actor, vendorId);
        if (scopedId) {
            where.vendor = { id: scopedId };
        }
        return this.taxService.findByColumns({ id: true, name: true, rate: true }, [], where, { name: 'ASC' });
    }

    @HasPermission('taxes_create')
    @Post()
    async create(@Actor() actor: AuthActor, @Body() body: TaxCreateDto) {
        const vendorId = requiredVendorId(actor, body.vendor_id);
        await this.taxService.assertUniqueName(vendorId, body.name);
        const { vendor_id, ...data } = body;
        const tax = await this.taxService.create({ ...data, vendor: { id: vendorId } });
        return this.get(actor, tax.id);
    }

    @HasPermission('taxes_view')
    @Get(':id')
    async get(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.taxService.accessible(actor, id, ['vendor']);
    }

    @HasPermission('taxes_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: TaxUpdateDto) {
        const tax = await this.taxService.accessible(actor, id);
        await this.taxService.assertUniqueName(tax.vendor_id, body.name, tax.id);
        const { vendor_id, ...data } = body;
        if (Object.keys(data).length) {
            await this.taxService.update(tax.id, data);
        }
        return this.get(actor, tax.id);
    }

    @HasPermission('taxes_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        const tax = await this.taxService.accessible(actor, id);
        if (await this.taxService.usageCount(tax.id)) {
            throw new BadRequestException('This tax is used by products and cannot be deleted');
        }
        return this.taxService.softDelete(tax.id);
    }

    @HasPermission('taxes_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: VendorScopedListDto, @Res() res: Response) {
        const response = await this.taxService.paginatedFindByColumns({}, ['vendor'], this.listWhere(actor, body), 1, 100000, sortOrder(body.sortBy));
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Vendor', key: 'vendor', width: 25, value: (row: any) => row.vendor?.business_name },
            { header: 'Rate (%)', key: 'rate', width: 12 },
            { header: 'Status', key: 'is_active', width: 12 },
            { header: 'Created At', key: 'created_at', width: 22 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Taxes', columns, response.data);
        }
        return this.exportService.excel(res, 'Taxes', columns, response.data);
    }
}
