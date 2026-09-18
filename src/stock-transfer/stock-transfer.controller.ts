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
import { StockTransferService } from './stock-transfer.service';
import { StockTransfer, StockTransferStatus } from './models/stock-transfer.entity';
import { StockTransferCreateDto, StockTransferListDto, StockTransferReceiveDto, StockTransferUpdateDto } from './models/stock-transfer.dto';

@ActorTypes(ActorType.CLIENT)
@Controller('stock-transfers')
export class StockTransferController {
    constructor(
        private stockTransferService: StockTransferService,
        private exportService: ExportService,
        @InjectRepository(StockTransfer, 'MainConnection') private readonly transferRepository: Repository<StockTransfer>,
    ) { }

    private listQuery(actor: AuthActor, body: StockTransferListDto) {
        const query = this.transferRepository
            .createQueryBuilder('stock_transfer')
            .leftJoinAndSelect('stock_transfer.from_clientstore', 'from_clientstore')
            .leftJoinAndSelect('stock_transfer.to_clientstore', 'to_clientstore');
        const storeColumns = body.direction === 'incoming'
            ? ['to_clientstore_id']
            : body.direction === 'outgoing'
                ? ['from_clientstore_id']
                : ['from_clientstore_id', 'to_clientstore_id'];
        applyDocumentFilters(query, 'stock_transfer', actor, {
            vendorId: requiredVendorId(actor),
            clientstoreId: body.clientstore_id,
            status: body.status,
            search: body.search,
            startDate: body.startDate,
            endDate: body.endDate,
        }, {
            storeColumns,
            dateColumn: 'transfer_date',
            searchColumns: ['stock_transfer.transfer_number', 'from_clientstore.store_name', 'to_clientstore.store_name'],
        });
        return query.orderBy('stock_transfer.id', body.sortBy === 'Oldest' ? 'ASC' : 'DESC');
    }

    @HasPermission('stock_transfers_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor, @Body() body: StockTransferListDto) {
        const rows = await this.listQuery(actor, { ...body, status: undefined })
            .select('stock_transfer.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .groupBy('stock_transfer.status')
            .orderBy()
            .getRawMany();
        const count = (status: StockTransferStatus) => Number(rows.find((row) => row.status === status)?.count || 0);
        return {
            totalTransfers: rows.reduce((sum, row) => sum + Number(row.count), 0),
            draftTransfers: count(StockTransferStatus.DRAFT),
            inTransit: count(StockTransferStatus.DISPATCHED),
            receivedTransfers: count(StockTransferStatus.RECEIVED),
        };
    }

    @HasPermission('stock_transfers_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: StockTransferListDto) {
        return paginateQuery(this.listQuery(actor, body), body.page || 1, body.take || 10);
    }

    @HasPermission('stock_transfers_create')
    @Post()
    async create(@Actor() actor: AuthActor, @Body() body: StockTransferCreateDto) {
        const transfer = await this.stockTransferService.createTransfer(actor, requiredVendorId(actor), body);
        return this.get(actor, transfer.id);
    }

    @HasPermission('stock_transfers_view')
    @Get(':id')
    async get(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.stockTransferService.accessible(actor, id, this.stockTransferService.detailRelations);
    }

    @HasPermission('stock_transfers_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: StockTransferUpdateDto) {
        const transfer = await this.stockTransferService.accessible(actor, id);
        await this.stockTransferService.updateTransfer(actor, transfer, body);
        return this.get(actor, transfer.id);
    }

    @HasPermission('stock_transfers_dispatch')
    @Put(':id/dispatch')
    async dispatch(@Actor() actor: AuthActor, @Param('id') id: number) {
        const transfer = await this.stockTransferService.accessible(actor, id);
        await this.stockTransferService.dispatch(actor, transfer.id);
        return this.get(actor, transfer.id);
    }

    @HasPermission('stock_transfers_receive')
    @Put(':id/receive')
    async receive(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: StockTransferReceiveDto) {
        const transfer = await this.stockTransferService.accessible(actor, id);
        await this.stockTransferService.receive(actor, transfer.id, body);
        return this.get(actor, transfer.id);
    }

    @HasPermission('stock_transfers_edit')
    @Put(':id/cancel')
    async cancel(@Actor() actor: AuthActor, @Param('id') id: number) {
        const transfer = await this.stockTransferService.accessible(actor, id);
        await this.stockTransferService.cancel(transfer);
        return this.get(actor, transfer.id);
    }

    @HasPermission('stock_transfers_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        const transfer = await this.stockTransferService.accessible(actor, id);
        if (transfer.status !== StockTransferStatus.DRAFT) {
            throw new BadRequestException('Only draft transfers can be deleted');
        }
        await this.stockTransferService.softDelete(transfer.id);
        return { message: 'Success' };
    }

    @HasPermission('stock_transfers_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: StockTransferListDto, @Res() res: Response) {
        const rows = await this.listQuery(actor, body).getMany();
        const columns = [
            { header: 'Transfer', key: 'transfer_number', width: 18 },
            { header: 'Date', key: 'transfer_date', width: 14 },
            { header: 'From', key: 'from_clientstore', width: 22, value: (row: any) => row.from_clientstore?.store_name },
            { header: 'To', key: 'to_clientstore', width: 22, value: (row: any) => row.to_clientstore?.store_name },
            { header: 'Status', key: 'status', width: 14 },
            { header: 'Value', key: 'total_value', width: 14 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Stock Transfers', columns, rows);
        }
        return this.exportService.excel(res, 'Stock Transfers', columns, rows);
    }
}
