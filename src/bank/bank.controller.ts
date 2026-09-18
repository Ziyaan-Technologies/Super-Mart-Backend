import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { activeStatusCondition, buildWhere, dateRangeCondition, sortOrder, VendorScopedListDto } from 'src/common/list-query';
import { requiredVendorId, scopedVendorId } from 'src/common/tenant-scope';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { BankService } from './bank.service';
import { BankCreateDto, BankUpdateDto } from './models/bank.dto';

@ActorTypes(ActorType.ADMIN, ActorType.CLIENT)
@Controller('banks')
export class BankController {
    constructor(
        private bankService: BankService,
        private exportService: ExportService
    ) { }

    private listWhere(actor: AuthActor, body: VendorScopedListDto) {
        const andConditions: any = { ...dateRangeCondition(body.startDate, body.endDate), ...activeStatusCondition(body.status) };
        const vendorId = scopedVendorId(actor, body.vendor_id);
        if (vendorId) {
            andConditions.vendor = { id: vendorId };
        }
        return buildWhere(['name'], body.search, andConditions);
    }

    @HasPermission('banks_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: VendorScopedListDto) {
        return this.bankService.paginatedFindByColumns({}, ['vendor'], this.listWhere(actor, body), body.page || 1, body.take || 10, sortOrder(body.sortBy));
    }

    @Get('list')
    async dropdown(@Actor() actor: AuthActor, @Query('vendor_id') vendorId?: number) {
        const where: any = { is_active: true };
        const scopedId = scopedVendorId(actor, vendorId);
        if (scopedId) {
            where.vendor = { id: scopedId };
        }
        return this.bankService.findByColumns({ id: true, name: true }, [], where, { name: 'ASC' });
    }

    @HasPermission('banks_create')
    @Post()
    async create(@Actor() actor: AuthActor, @Body() body: BankCreateDto) {
        const vendorId = requiredVendorId(actor, body.vendor_id);
        await this.bankService.assertUniqueName(vendorId, body.name);
        const { vendor_id, ...data } = body;
        const bank = await this.bankService.create({ ...data, vendor: { id: vendorId } });
        return this.get(actor, bank.id);
    }

    @HasPermission('banks_view')
    @Get(':id')
    async get(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.bankService.accessible(actor, id, ['vendor']);
    }

    @HasPermission('banks_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: BankUpdateDto) {
        const bank = await this.bankService.accessible(actor, id);
        await this.bankService.assertUniqueName(bank.vendor_id, body.name, bank.id);
        const { vendor_id, ...data } = body;
        if (Object.keys(data).length) {
            await this.bankService.update(bank.id, data);
        }
        return this.get(actor, bank.id);
    }

    @HasPermission('banks_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        const bank = await this.bankService.accessible(actor, id);
        return this.bankService.softDelete(bank.id);
    }

    @HasPermission('banks_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: VendorScopedListDto, @Res() res: Response) {
        const response = await this.bankService.paginatedFindByColumns({}, ['vendor'], this.listWhere(actor, body), 1, 100000, sortOrder(body.sortBy));
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Status', key: 'is_active', width: 12 },
            { header: 'Created At', key: 'created_at', width: 22 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Banks', columns, response.data);
        }
        return this.exportService.excel(res, 'Banks', columns, response.data);
    }
}
