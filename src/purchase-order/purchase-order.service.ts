import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { AuthActor } from 'src/common/auth-actor';
import { priceLines } from 'src/common/document-lines';
import { documentNumber } from 'src/common/document-number';
import { roundQuantity } from 'src/common/decimal.transformer';
import { assertStoreDocumentAccess } from 'src/common/tenant-scope';
import { ProductService } from 'src/product/product.service';
import { SupplierService } from 'src/supplier/supplier.service';
import { ClientstoreService } from 'src/clientstore/clientstore.service';
import { PurchaseOrder, PurchaseOrderStatus } from './models/purchase-order.entity';
import { PurchaseOrderItem } from './models/purchase-order-item.entity';
import { PurchaseOrderCreateDto, PurchaseOrderItemDto, PurchaseOrderUpdateDto } from './models/purchase-order.dto';

@Injectable()
export class PurchaseOrderService extends AbstractService {
    constructor(
        @InjectRepository(PurchaseOrder, 'MainConnection') private readonly orderRepository: Repository<PurchaseOrder>,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
        private productService: ProductService,
        private supplierService: SupplierService,
        private clientstoreService: ClientstoreService,
    ) {
        super(orderRepository);
    }

    readonly detailRelations = ['clientstore', 'supplier', 'items', 'items.product_variant', 'items.product_variant.product', 'items.product_variant.product.unit', 'created_by', 'approved_by'];

    async accessible(actor: AuthActor, id: number, relations: string[] = []): Promise<PurchaseOrder> {
        const order = await this.orderRepository.findOne({ where: { id }, relations });
        if (!order) {
            throw new NotFoundException('Purchase order not found');
        }
        assertStoreDocumentAccess(actor, order.vendor_id, [order.clientstore_id]);
        return order;
    }

    private async validate(actor: AuthActor, vendorId: number, clientstoreId: number, supplierId: number, items: PurchaseOrderItemDto[]) {
        await this.clientstoreService.accessible(actor, clientstoreId);
        const supplier = await this.supplierService.assertOwnedByVendor(supplierId, vendorId);
        if (!supplier.is_active) {
            throw new BadRequestException('The selected supplier is inactive');
        }
        const variantIds = items.map((item) => item.product_variant_id);
        if (new Set(variantIds).size !== variantIds.length) {
            throw new BadRequestException('Each product can only appear once in a purchase order');
        }
        await this.productService.variantsForVendor(vendorId, variantIds);
    }

    private async saveItems(manager: EntityManager, orderId: number, items: PurchaseOrderItemDto[]) {
        const priced = priceLines(items);
        await manager.save(PurchaseOrderItem, priced.lines.map((line) => ({
            purchase_order: { id: orderId },
            product_variant: { id: line.product_variant_id },
            quantity: line.quantity,
            unit_cost: line.unit_cost,
            tax_rate: line.tax_rate,
            discount_amount: line.discount_amount,
            tax_amount: line.tax_amount,
            line_total: line.line_total,
        })));
        await manager.update(PurchaseOrder, orderId, {
            subtotal: priced.subtotal,
            discount_amount: priced.discount_amount,
            tax_amount: priced.tax_amount,
            total_amount: priced.total_amount,
        });
    }

    async createOrder(actor: AuthActor, vendorId: number, body: PurchaseOrderCreateDto) {
        await this.validate(actor, vendorId, body.clientstore_id, body.supplier_id, body.items);
        return this.dataSource.transaction(async (manager) => {
            const order = await manager.save(PurchaseOrder, {
                vendor: { id: vendorId },
                clientstore: { id: body.clientstore_id },
                supplier: { id: body.supplier_id },
                order_date: body.order_date,
                expected_date: body.expected_date || null,
                note: body.note || null,
                status: PurchaseOrderStatus.DRAFT,
                created_by: { id: actor.id },
            });
            await manager.update(PurchaseOrder, order.id, { po_number: documentNumber('PO', order.id) });
            await this.saveItems(manager, order.id, body.items);
            return order;
        });
    }

    async updateOrder(actor: AuthActor, order: PurchaseOrder, body: PurchaseOrderUpdateDto) {
        if (order.status !== PurchaseOrderStatus.DRAFT) {
            throw new BadRequestException('Only draft purchase orders can be edited');
        }
        const clientstoreId = body.clientstore_id ?? order.clientstore_id;
        const supplierId = body.supplier_id ?? order.supplier_id;
        if (body.items) {
            await this.validate(actor, order.vendor_id, clientstoreId, supplierId, body.items);
        } else if (body.clientstore_id || body.supplier_id) {
            await this.clientstoreService.accessible(actor, clientstoreId);
            await this.supplierService.assertOwnedByVendor(supplierId, order.vendor_id);
        }
        await this.dataSource.transaction(async (manager) => {
            const header: any = {};
            if (body.clientstore_id) header.clientstore = { id: body.clientstore_id };
            if (body.supplier_id) header.supplier = { id: body.supplier_id };
            if (body.order_date) header.order_date = body.order_date;
            if (body.expected_date !== undefined) header.expected_date = body.expected_date || null;
            if (body.note !== undefined) header.note = body.note || null;
            if (Object.keys(header).length) {
                await manager.update(PurchaseOrder, order.id, header);
            }
            if (body.items) {
                const existing = await manager.find(PurchaseOrderItem, { where: { purchase_order: { id: order.id } } });
                if (existing.length) {
                    await manager.delete(PurchaseOrderItem, existing.map((item) => item.id));
                }
                await this.saveItems(manager, order.id, body.items);
            }
        });
    }

    async approve(actor: AuthActor, order: PurchaseOrder) {
        if (order.status !== PurchaseOrderStatus.DRAFT) {
            throw new BadRequestException('Only draft purchase orders can be approved');
        }
        await this.orderRepository.update(order.id, {
            status: PurchaseOrderStatus.APPROVED,
            approved_by: { id: actor.id },
            approved_at: new Date(),
        });
    }

    async cancel(order: PurchaseOrder) {
        if (![PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.APPROVED].includes(order.status)) {
            throw new BadRequestException('Only draft or approved purchase orders with no receipts can be cancelled');
        }
        await this.orderRepository.update(order.id, { status: PurchaseOrderStatus.CANCELLED });
    }

    async lockForReceipt(manager: EntityManager, orderId: number): Promise<PurchaseOrder> {
        const order = await manager
            .createQueryBuilder(PurchaseOrder, 'purchase_order')
            .setLock('pessimistic_write')
            .where('purchase_order.id = :orderId', { orderId })
            .getOne();
        if (!order || ![PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED].includes(order.status)) {
            throw new BadRequestException('Goods can only be received against an approved purchase order');
        }
        return order;
    }

    async refreshStatus(manager: EntityManager, orderId: number) {
        const items = await manager.find(PurchaseOrderItem, { where: { purchase_order: { id: orderId } } });
        const received = items.some((item) => item.received_quantity > 0);
        const complete = items.every((item) => roundQuantity(item.received_quantity) >= roundQuantity(item.quantity));
        const status = complete ? PurchaseOrderStatus.RECEIVED : received ? PurchaseOrderStatus.PARTIALLY_RECEIVED : PurchaseOrderStatus.APPROVED;
        await manager.update(PurchaseOrder, orderId, { status });
    }
}
