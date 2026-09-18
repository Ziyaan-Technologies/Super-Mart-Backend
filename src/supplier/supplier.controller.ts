import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { activeStatusCondition, buildWhere, dateRangeCondition, growth, previousDateRangeCondition, sortOrder, VendorScopedListDto } from 'src/common/list-query';
import { requiredVendorId, scopedVendorId } from 'src/common/tenant-scope';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { SupplierService } from './supplier.service';
import { SupplierCreateDto, SupplierUpdateDto } from './models/supplier.dto';

@ActorTypes(ActorType.ADMIN, ActorType.CLIENT)
@Controller('suppliers')
export class SupplierController {
    constructor(
        private supplierService: SupplierService,
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
        return buildWhere(['name', 'contact_person', 'phone', 'email'], body.search, this.andConditions(actor, body, dateRangeCondition(body.startDate, body.endDate)));
    }

    @HasPermission('suppliers_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor, @Body() body: VendorScopedListDto) {
        const current = this.andConditions(actor, body, dateRangeCondition(body.startDate, body.endDate));
        const previous = this.andConditions(actor, body, previousDateRangeCondition(body.startDate, body.endDate));
        const totalSuppliers = await this.supplierService.count(current);
        const activeSuppliers = await this.supplierService.count({ ...current, is_active: true });
        const inactiveSuppliers = await this.supplierService.count({ ...current, is_active: false });
        const previousTotal = body.startDate && body.endDate ? await this.supplierService.count(previous) : 0;
        return {
            totalSuppliers,
            totalSuppliersGrowth: growth(totalSuppliers, previousTotal, body.startDate, body.endDate),
            activeSuppliers,
            inactiveSuppliers,
        };
    }

    @HasPermission('suppliers_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: VendorScopedListDto) {
        return this.supplierService.paginatedFindByColumns({}, ['vendor'], this.listWhere(actor, body), body.page || 1, body.take || 10, sortOrder(body.sortBy));
    }

    @Get('list')
    async dropdown(@Actor() actor: AuthActor, @Query('vendor_id') vendorId?: number) {
        const where: any = { is_active: true };
        const scopedId = scopedVendorId(actor, vendorId);
        if (scopedId) {
            where.vendor = { id: scopedId };
        }
        return this.supplierService.findByColumns({ id: true, name: true, phone: true, payment_terms_days: true }, [], where, { name: 'ASC' });
    }

    @HasPermission('suppliers_create')
    @Post()
    async create(@Actor() actor: AuthActor, @Body() body: SupplierCreateDto) {
        const vendorId = requiredVendorId(actor, body.vendor_id);
        await this.supplierService.assertUniqueName(vendorId, body.name);
        const { vendor_id, city_id, ...data } = body;
        const supplier = await this.supplierService.create({ ...data, city: city_id ? { id: city_id } : null, vendor: { id: vendorId } });
        return this.get(actor, supplier.id);
    }

    @HasPermission('suppliers_view')
    @Get(':id')
    async get(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.supplierService.accessible(actor, id, ['vendor', 'city']);
    }

    @HasPermission('suppliers_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: SupplierUpdateDto) {
        const supplier = await this.supplierService.accessible(actor, id);
        await this.supplierService.assertUniqueName(supplier.vendor_id, body.name, supplier.id);
        const { vendor_id, city_id, ...data } = body;
        const changes: any = { ...data, ...(city_id !== undefined ? { city: city_id ? { id: city_id } : null } : {}) };
        if (Object.keys(changes).length) {
            await this.supplierService.update(supplier.id, changes);
        }
        return this.get(actor, supplier.id);
    }

    @HasPermission('suppliers_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        const supplier = await this.supplierService.accessible(actor, id);
        if (await this.supplierService.usageCount(supplier.id)) {
            throw new BadRequestException('This supplier has purchase documents and cannot be deleted');
        }
        return this.supplierService.softDelete(supplier.id);
    }

    @HasPermission('suppliers_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: VendorScopedListDto, @Res() res: Response) {
        const response = await this.supplierService.paginatedFindByColumns({}, ['vendor'], this.listWhere(actor, body), 1, 100000, sortOrder(body.sortBy));
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Vendor', key: 'vendor', width: 25, value: (row: any) => row.vendor?.business_name },
            { header: 'Contact', key: 'contact_person', width: 20 },
            { header: 'Phone', key: 'phone', width: 18 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Terms (days)', key: 'payment_terms_days', width: 12 },
            { header: 'Status', key: 'is_active', width: 12 },
            { header: 'Created At', key: 'created_at', width: 22 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Suppliers', columns, response.data);
        }
        return this.exportService.excel(res, 'Suppliers', columns, response.data);
    }
}
