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
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseOrder, PurchaseOrderStatus } from './models/purchase-order.entity';
import { PurchaseOrderCreateDto, PurchaseOrderListDto, PurchaseOrderUpdateDto } from './models/purchase-order.dto';

@ActorTypes(ActorType.CLIENT)
@Controller('purchase-orders')
export class PurchaseOrderController {
    constructor(
        private purchaseOrderService: PurchaseOrderService,
        private exportService: ExportService,
        @InjectRepository(PurchaseOrder, 'MainConnection') private readonly orderRepository: Repository<PurchaseOrder>,
    ) { }

    private listQuery(actor: AuthActor, body: PurchaseOrderListDto) {
        const query = this.orderRepository
            .createQueryBuilder('purchase_order')
            .leftJoinAndSelect('purchase_order.clientstore', 'clientstore')
            .leftJoinAndSelect('purchase_order.supplier', 'supplier');
        applyDocumentFilters(query, 'purchase_order', actor, {
            vendorId: requiredVendorId(actor),
            clientstoreId: body.clientstore_id,
            status: body.status,
            search: body.search,
            startDate: body.startDate,
            endDate: body.endDate,
        }, {
            storeColumns: ['clientstore_id'],
            dateColumn: 'order_date',
            searchColumns: ['purchase_order.po_number', 'supplier.name', 'purchase_order.note'],
        });
        if (body.supplier_id) {
            query.andWhere('purchase_order.supplier_id = :supplierId', { supplierId: body.supplier_id });
        }
        return query.orderBy('purchase_order.id', body.sortBy === 'Oldest' ? 'ASC' : 'DESC');
    }

    @HasPermission('purchase_orders_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor, @Body() body: PurchaseOrderListDto) {
        const rows = await this.listQuery(actor, { ...body, status: undefined })
            .select('purchase_order.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(purchase_order.total_amount), 0)', 'amount')
            .groupBy('purchase_order.status')
            .orderBy()
            .getRawMany();
        const byStatus = (status: PurchaseOrderStatus) => rows.find((row) => row.status === status);
        const count = (status: PurchaseOrderStatus) => Number(byStatus(status)?.count || 0);
        const openStatuses = [PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED];
        return {
            totalOrders: rows.reduce((sum, row) => sum + Number(row.count), 0),
            draftOrders: count(PurchaseOrderStatus.DRAFT),
            openOrders: openStatuses.reduce((sum, status) => sum + count(status), 0),
            receivedOrders: count(PurchaseOrderStatus.RECEIVED),
            openAmount: openStatuses.reduce((sum, status) => sum + parseFloat(byStatus(status)?.amount || 0), 0),
        };
    }

    @HasPermission('purchase_orders_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: PurchaseOrderListDto) {
        return paginateQuery(this.listQuery(actor, body), body.page || 1, body.take || 10);
    }

    @HasPermission('purchase_orders_view', 'goods_receipts_create')
    @Get('receivable')
    async receivable(@Actor() actor: AuthActor) {
        return this.listQuery(actor, {})
            .andWhere('purchase_order.status IN (:...statuses)', { statuses: [PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED] })
            .getMany();
    }

    @HasPermission('purchase_orders_create')
    @Post()
    async create(@Actor() actor: AuthActor, @Body() body: PurchaseOrderCreateDto) {
        const order = await this.purchaseOrderService.createOrder(actor, requiredVendorId(actor), body);
        return this.get(actor, order.id);
    }

    @HasPermission('purchase_orders_view', 'goods_receipts_create')
    @Get(':id')
    async get(@Actor() actor: AuthActor, @Param('id') id: number) {
        const order = await this.purchaseOrderService.accessible(actor, id, this.purchaseOrderService.detailRelations);
        const receipts = await this.orderRepository.query(
            'SELECT id, grn_number, received_date, status, total_amount FROM goods_receipts WHERE purchase_order_id = ? AND deleted_at IS NULL ORDER BY id DESC',
            [order.id],
        );
        return { ...order, receipts };
    }

    @HasPermission('purchase_orders_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: PurchaseOrderUpdateDto) {
        const order = await this.purchaseOrderService.accessible(actor, id);
        await this.purchaseOrderService.updateOrder(actor, order, body);
        return this.get(actor, order.id);
    }

    @HasPermission('purchase_orders_approve')
    @Put(':id/approve')
    async approve(@Actor() actor: AuthActor, @Param('id') id: number) {
        const order = await this.purchaseOrderService.accessible(actor, id);
        await this.purchaseOrderService.approve(actor, order);
        return this.get(actor, order.id);
    }

    @HasPermission('purchase_orders_edit', 'purchase_orders_approve')
    @Put(':id/cancel')
    async cancel(@Actor() actor: AuthActor, @Param('id') id: number) {
        const order = await this.purchaseOrderService.accessible(actor, id);
        await this.purchaseOrderService.cancel(order);
        return this.get(actor, order.id);
    }

    @HasPermission('purchase_orders_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        const order = await this.purchaseOrderService.accessible(actor, id);
        if (order.status !== PurchaseOrderStatus.DRAFT) {
            throw new BadRequestException('Only draft purchase orders can be deleted. Cancel it instead.');
        }
        await this.purchaseOrderService.softDelete(order.id);
        return { message: 'Success' };
    }

    @HasPermission('purchase_orders_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: PurchaseOrderListDto, @Res() res: Response) {
        const rows = await this.listQuery(actor, body).getMany();
        const columns = [
            { header: 'PO Number', key: 'po_number', width: 18 },
            { header: 'Order Date', key: 'order_date', width: 14 },
            { header: 'Expected', key: 'expected_date', width: 14 },
            { header: 'Store', key: 'clientstore', width: 20, value: (row: any) => row.clientstore?.store_name },
            { header: 'Supplier', key: 'supplier', width: 22, value: (row: any) => row.supplier?.name },
            { header: 'Status', key: 'status', width: 18 },
            { header: 'Total', key: 'total_amount', width: 14 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Purchase Orders', columns, rows);
        }
        return this.exportService.excel(res, 'Purchase Orders', columns, rows);
    }
}
