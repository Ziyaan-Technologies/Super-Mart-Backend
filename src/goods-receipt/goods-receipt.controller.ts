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
import { GoodsReceiptService } from './goods-receipt.service';
import { GoodsReceipt, GoodsReceiptStatus } from './models/goods-receipt.entity';
import { GoodsReceiptCreateDto, GoodsReceiptListDto, GoodsReceiptUpdateDto } from './models/goods-receipt.dto';

@ActorTypes(ActorType.CLIENT)
@Controller('goods-receipts')
export class GoodsReceiptController {
    constructor(
        private goodsReceiptService: GoodsReceiptService,
        private exportService: ExportService,
        @InjectRepository(GoodsReceipt, 'MainConnection') private readonly receiptRepository: Repository<GoodsReceipt>,
    ) { }

    private listQuery(actor: AuthActor, body: GoodsReceiptListDto) {
        const query = this.receiptRepository
            .createQueryBuilder('goods_receipt')
            .leftJoinAndSelect('goods_receipt.clientstore', 'clientstore')
            .leftJoinAndSelect('goods_receipt.supplier', 'supplier')
            .leftJoinAndSelect('goods_receipt.purchase_order', 'purchase_order');
        applyDocumentFilters(query, 'goods_receipt', actor, {
            vendorId: requiredVendorId(actor),
            clientstoreId: body.clientstore_id,
            status: body.status,
            search: body.search,
            startDate: body.startDate,
            endDate: body.endDate,
        }, {
            storeColumns: ['clientstore_id'],
            dateColumn: 'received_date',
            searchColumns: ['goods_receipt.grn_number', 'goods_receipt.supplier_invoice_number', 'supplier.name', 'purchase_order.po_number'],
        });
        if (body.supplier_id) {
            query.andWhere('goods_receipt.supplier_id = :supplierId', { supplierId: body.supplier_id });
        }
        if (body.purchase_order_id) {
            query.andWhere('goods_receipt.purchase_order_id = :purchaseOrderId', { purchaseOrderId: body.purchase_order_id });
        }
        return query.orderBy('goods_receipt.id', body.sortBy === 'Oldest' ? 'ASC' : 'DESC');
    }

    @HasPermission('goods_receipts_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor, @Body() body: GoodsReceiptListDto) {
        const rows = await this.listQuery(actor, { ...body, status: undefined })
            .select('goods_receipt.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(goods_receipt.total_amount), 0)', 'amount')
            .groupBy('goods_receipt.status')
            .orderBy()
            .getRawMany();
        const row = (status: GoodsReceiptStatus) => rows.find((item) => item.status === status);
        return {
            totalReceipts: rows.reduce((sum, item) => sum + Number(item.count), 0),
            draftReceipts: Number(row(GoodsReceiptStatus.DRAFT)?.count || 0),
            postedReceipts: Number(row(GoodsReceiptStatus.POSTED)?.count || 0),
            postedAmount: parseFloat(row(GoodsReceiptStatus.POSTED)?.amount || 0),
        };
    }

    @HasPermission('goods_receipts_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: GoodsReceiptListDto) {
        return paginateQuery(this.listQuery(actor, body), body.page || 1, body.take || 10);
    }

    @HasPermission('goods_receipts_create')
    @Post()
    async create(@Actor() actor: AuthActor, @Body() body: GoodsReceiptCreateDto) {
        const receipt = await this.goodsReceiptService.createReceipt(actor, requiredVendorId(actor), body);
        return this.get(actor, receipt.id);
    }

    @HasPermission('goods_receipts_view')
    @Get(':id')
    async get(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.goodsReceiptService.accessible(actor, id, this.goodsReceiptService.detailRelations);
    }

    @HasPermission('goods_receipts_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: GoodsReceiptUpdateDto) {
        const receipt = await this.goodsReceiptService.accessible(actor, id);
        await this.goodsReceiptService.updateReceipt(actor, receipt, body);
        return this.get(actor, receipt.id);
    }

    @HasPermission('goods_receipts_post')
    @Put(':id/post')
    async post(@Actor() actor: AuthActor, @Param('id') id: number) {
        const receipt = await this.goodsReceiptService.accessible(actor, id);
        await this.goodsReceiptService.post(actor, receipt.id);
        return this.get(actor, receipt.id);
    }

    @HasPermission('goods_receipts_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        const receipt = await this.goodsReceiptService.accessible(actor, id);
        if (receipt.status !== GoodsReceiptStatus.DRAFT) {
            throw new BadRequestException('Posted goods receipts cannot be deleted');
        }
        await this.goodsReceiptService.softDelete(receipt.id);
        return { message: 'Success' };
    }

    @HasPermission('goods_receipts_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: GoodsReceiptListDto, @Res() res: Response) {
        const rows = await this.listQuery(actor, body).getMany();
        const columns = [
            { header: 'GRN Number', key: 'grn_number', width: 18 },
            { header: 'Received', key: 'received_date', width: 14 },
            { header: 'Store', key: 'clientstore', width: 20, value: (row: any) => row.clientstore?.store_name },
            { header: 'Supplier', key: 'supplier', width: 22, value: (row: any) => row.supplier?.name },
            { header: 'PO', key: 'purchase_order', width: 18, value: (row: any) => row.purchase_order?.po_number },
            { header: 'Invoice', key: 'supplier_invoice_number', width: 16 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Total', key: 'total_amount', width: 14 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Goods Receipts', columns, rows);
        }
        return this.exportService.excel(res, 'Goods Receipts', columns, rows);
    }
}
