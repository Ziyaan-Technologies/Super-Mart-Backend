import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { requiredVendorId } from 'src/common/tenant-scope';
import { applyDocumentFilters, paginateQuery } from 'src/common/document-list';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { StockAdjustmentService } from './stock-adjustment.service';
import { AdjustmentReason, StockAdjustment, StockAdjustmentStatus } from './models/stock-adjustment.entity';
import { StockAdjustmentCreateDto, StockAdjustmentListDto, StockAdjustmentUpdateDto } from './models/stock-adjustment.dto';

@ActorTypes(ActorType.CLIENT)
@Controller('stock-adjustments')
export class StockAdjustmentController {
    constructor(
        private stockAdjustmentService: StockAdjustmentService,
        private exportService: ExportService,
        @InjectRepository(StockAdjustment, 'MainConnection') private readonly adjustmentRepository: Repository<StockAdjustment>,
    ) { }

    private listQuery(actor: AuthActor, body: StockAdjustmentListDto) {
        const query = this.adjustmentRepository
            .createQueryBuilder('stock_adjustment')
            .leftJoinAndSelect('stock_adjustment.clientstore', 'clientstore');
        applyDocumentFilters(query, 'stock_adjustment', actor, {
            vendorId: requiredVendorId(actor),
            clientstoreId: body.clientstore_id,
            status: body.status,
            search: body.search,
            startDate: body.startDate,
            endDate: body.endDate,
        }, {
            storeColumns: ['clientstore_id'],
            dateColumn: 'adjustment_date',
            searchColumns: ['stock_adjustment.adjustment_number', 'stock_adjustment.note', 'clientstore.store_name'],
        });
        if (body.reason) {
            query.andWhere('stock_adjustment.reason = :reason', { reason: body.reason });
        }
        return query.orderBy('stock_adjustment.id', body.sortBy === 'Oldest' ? 'ASC' : 'DESC');
    }

    @Get('reasons')
    async reasons() {
        return Object.values(AdjustmentReason);
    }

    @HasPermission('stock_adjustments_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor, @Body() body: StockAdjustmentListDto) {
        const rows = await this.listQuery(actor, { ...body, status: undefined })
            .select('stock_adjustment.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(stock_adjustment.total_value), 0)', 'value')
            .groupBy('stock_adjustment.status')
            .orderBy()
            .getRawMany();
        const row = (status: StockAdjustmentStatus) => rows.find((item) => item.status === status);
        return {
            totalAdjustments: rows.reduce((sum, item) => sum + Number(item.count), 0),
            draftAdjustments: Number(row(StockAdjustmentStatus.DRAFT)?.count || 0),
            postedAdjustments: Number(row(StockAdjustmentStatus.POSTED)?.count || 0),
            netValue: parseFloat(row(StockAdjustmentStatus.POSTED)?.value || 0),
        };
    }

    @HasPermission('stock_adjustments_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: StockAdjustmentListDto) {
        return paginateQuery(this.listQuery(actor, body), body.page || 1, body.take || 10);
    }

    @HasPermission('stock_adjustments_create')
    @Post()
    async create(@Actor() actor: AuthActor, @Body() body: StockAdjustmentCreateDto) {
        const adjustment = await this.stockAdjustmentService.createAdjustment(actor, requiredVendorId(actor), body);
        return this.get(actor, adjustment.id);
    }

    @HasPermission('stock_adjustments_view')
    @Get(':id')
    async get(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.stockAdjustmentService.accessible(actor, id, this.stockAdjustmentService.detailRelations);
    }

    @HasPermission('stock_adjustments_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: StockAdjustmentUpdateDto) {
        const adjustment = await this.stockAdjustmentService.accessible(actor, id);
        await this.stockAdjustmentService.updateAdjustment(actor, adjustment, body);
        return this.get(actor, adjustment.id);
    }

    @HasPermission('stock_adjustments_post')
    @Put(':id/post')
    async post(@Actor() actor: AuthActor, @Param('id') id: number) {
        const adjustment = await this.stockAdjustmentService.accessible(actor, id);
        await this.stockAdjustmentService.post(actor, adjustment.id);
        return this.get(actor, adjustment.id);
    }

    @HasPermission('stock_adjustments_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        const adjustment = await this.stockAdjustmentService.accessible(actor, id);
        if (adjustment.status !== StockAdjustmentStatus.DRAFT) {
            throw new BadRequestException('Posted adjustments cannot be deleted');
        }
        await this.stockAdjustmentService.softDelete(adjustment.id);
        return { message: 'Success' };
    }

    @HasPermission('stock_adjustments_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: StockAdjustmentListDto, @Res() res: Response) {
        const rows = await this.listQuery(actor, body).getMany();
        const columns = [
            { header: 'Number', key: 'adjustment_number', width: 18 },
            { header: 'Date', key: 'adjustment_date', width: 14 },
            { header: 'Store', key: 'clientstore', width: 22, value: (row: any) => row.clientstore?.store_name },
            { header: 'Reason', key: 'reason', width: 18 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Value', key: 'total_value', width: 14 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Stock Adjustments', columns, rows);
        }
        return this.exportService.excel(res, 'Stock Adjustments', columns, rows);
    }
}
