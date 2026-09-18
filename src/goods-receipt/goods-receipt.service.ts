import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { AuthActor } from 'src/common/auth-actor';
import { priceLines } from 'src/common/document-lines';
import { documentNumber } from 'src/common/document-number';
import { roundCost, roundQuantity } from 'src/common/decimal.transformer';
import { assertStoreDocumentAccess } from 'src/common/tenant-scope';
import { ProductService } from 'src/product/product.service';
import { SupplierService } from 'src/supplier/supplier.service';
import { ClientstoreService } from 'src/clientstore/clientstore.service';
import { StockService } from 'src/stock/stock.service';
import { StockMovementType } from 'src/stock/models/stock-movement.entity';
import { PurchaseOrderService } from 'src/purchase-order/purchase-order.service';
import { PurchaseOrder, PurchaseOrderStatus } from 'src/purchase-order/models/purchase-order.entity';
import { PurchaseOrderItem } from 'src/purchase-order/models/purchase-order-item.entity';
import { ProductVariant } from 'src/product/models/product-variant.entity';
import { GoodsReceipt, GoodsReceiptStatus } from './models/goods-receipt.entity';
import { GoodsReceiptItem } from './models/goods-receipt-item.entity';
import { GoodsReceiptCreateDto, GoodsReceiptItemDto, GoodsReceiptUpdateDto } from './models/goods-receipt.dto';

@Injectable()
export class GoodsReceiptService extends AbstractService {
    constructor(
        @InjectRepository(GoodsReceipt, 'MainConnection') private readonly receiptRepository: Repository<GoodsReceipt>,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
        private productService: ProductService,
        private supplierService: SupplierService,
        private clientstoreService: ClientstoreService,
        private stockService: StockService,
        private purchaseOrderService: PurchaseOrderService,
    ) {
        super(receiptRepository);
    }

    readonly detailRelations = ['clientstore', 'supplier', 'purchase_order', 'items', 'items.product_variant', 'items.product_variant.product', 'items.product_variant.product.unit', 'items.purchase_order_item', 'created_by', 'posted_by'];

    async accessible(actor: AuthActor, id: number, relations: string[] = []): Promise<GoodsReceipt> {
        const receipt = await this.receiptRepository.findOne({ where: { id }, relations });
        if (!receipt) {
            throw new NotFoundException('Goods receipt not found');
        }
        assertStoreDocumentAccess(actor, receipt.vendor_id, [receipt.clientstore_id]);
        return receipt;
    }

    private async validate(actor: AuthActor, vendorId: number, header: { clientstore_id: number; supplier_id: number; purchase_order_id?: number | null }, items: GoodsReceiptItemDto[]) {
        await this.clientstoreService.accessible(actor, header.clientstore_id);
        await this.supplierService.assertOwnedByVendor(header.supplier_id, vendorId);
        const variants = await this.productService.variantsForVendor(vendorId, items.map((item) => item.product_variant_id));
        if (header.purchase_order_id) {
            const order = await this.purchaseOrderService.findOne({ id: header.purchase_order_id }, ['items']) as PurchaseOrder;
            if (!order || order.vendor_id !== Number(vendorId)) {
                throw new BadRequestException('The selected purchase order is not valid');
            }
            if (order.clientstore_id !== Number(header.clientstore_id) || order.supplier_id !== Number(header.supplier_id)) {
                throw new BadRequestException('Store and supplier must match the purchase order');
            }
            if (![PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED].includes(order.status)) {
                throw new BadRequestException('Goods can only be received against an approved purchase order');
            }
            for (const item of items) {
                const orderItem = order.items.find((row) => row.id === Number(item.purchase_order_item_id));
                if (!orderItem || orderItem.product_variant_id !== Number(item.product_variant_id)) {
                    throw new BadRequestException('Every line must match a line on the purchase order');
                }
            }
        } else if (items.some((item) => item.purchase_order_item_id)) {
            throw new BadRequestException('purchase_order_id is required when lines reference a purchase order');
        }
        return variants;
    }

    private assertExpiry(variants: Map<number, ProductVariant>, items: { product_variant_id: number; expiry_date?: string }[]) {
        for (const item of items) {
            const variant = variants.get(Number(item.product_variant_id));
            if (variant?.product?.track_expiry && !item.expiry_date) {
                throw new BadRequestException(`Expiry date is required for ${variant.product.name} (${variant.name})`);
            }
        }
    }

    private async saveItems(manager: EntityManager, receiptId: number, items: GoodsReceiptItemDto[]) {
        const priced = priceLines(items);
        await manager.save(GoodsReceiptItem, priced.lines.map((line) => ({
            goods_receipt: { id: receiptId },
            product_variant: { id: line.product_variant_id },
            purchase_order_item: line.purchase_order_item_id ? { id: line.purchase_order_item_id } : null,
            quantity: line.quantity,
            free_quantity: line.free_quantity || 0,
            unit_cost: line.unit_cost,
            tax_rate: line.tax_rate,
            discount_amount: line.discount_amount,
            tax_amount: line.tax_amount,
            line_total: line.line_total,
            batch_number: line.batch_number || null,
            expiry_date: line.expiry_date || null,
        })));
        await manager.update(GoodsReceipt, receiptId, {
            subtotal: priced.subtotal,
            discount_amount: priced.discount_amount,
            tax_amount: priced.tax_amount,
            total_amount: priced.total_amount,
        });
    }

    async createReceipt(actor: AuthActor, vendorId: number, body: GoodsReceiptCreateDto) {
        const variants = await this.validate(actor, vendorId, body, body.items);
        this.assertExpiry(variants, body.items);
        return this.dataSource.transaction(async (manager) => {
            const receipt = await manager.save(GoodsReceipt, {
                vendor: { id: vendorId },
                clientstore: { id: body.clientstore_id },
                supplier: { id: body.supplier_id },
                purchase_order: body.purchase_order_id ? { id: body.purchase_order_id } : null,
                received_date: body.received_date,
                supplier_invoice_number: body.supplier_invoice_number || null,
                note: body.note || null,
                status: GoodsReceiptStatus.DRAFT,
                created_by: { id: actor.id },
            });
            await manager.update(GoodsReceipt, receipt.id, { grn_number: documentNumber('GRN', receipt.id) });
            await this.saveItems(manager, receipt.id, body.items);
            return receipt;
        });
    }

    async updateReceipt(actor: AuthActor, receipt: GoodsReceipt, body: GoodsReceiptUpdateDto) {
        if (receipt.status !== GoodsReceiptStatus.DRAFT) {
            throw new BadRequestException('Only draft goods receipts can be edited');
        }
        const header = {
            clientstore_id: body.clientstore_id ?? receipt.clientstore_id,
            supplier_id: body.supplier_id ?? receipt.supplier_id,
            purchase_order_id: body.purchase_order_id !== undefined ? body.purchase_order_id : receipt.purchase_order_id,
        };
        if (body.items) {
            const variants = await this.validate(actor, receipt.vendor_id, header, body.items);
            this.assertExpiry(variants, body.items);
        } else if (body.clientstore_id || body.supplier_id || body.purchase_order_id !== undefined) {
            throw new BadRequestException('Send the lines again when changing the store, supplier or purchase order');
        }
        await this.dataSource.transaction(async (manager) => {
            const changes: any = {};
            if (body.clientstore_id) changes.clientstore = { id: body.clientstore_id };
            if (body.supplier_id) changes.supplier = { id: body.supplier_id };
            if (body.purchase_order_id !== undefined) changes.purchase_order = body.purchase_order_id ? { id: body.purchase_order_id } : null;
            if (body.received_date) changes.received_date = body.received_date;
            if (body.supplier_invoice_number !== undefined) changes.supplier_invoice_number = body.supplier_invoice_number || null;
            if (body.note !== undefined) changes.note = body.note || null;
            if (Object.keys(changes).length) {
                await manager.update(GoodsReceipt, receipt.id, changes);
            }
            if (body.items) {
                const existing = await manager.find(GoodsReceiptItem, { where: { goods_receipt: { id: receipt.id } } });
                if (existing.length) {
                    await manager.delete(GoodsReceiptItem, existing.map((item) => item.id));
                }
                await this.saveItems(manager, receipt.id, body.items);
            }
        });
    }

    async post(actor: AuthActor, receiptId: number) {
        await this.dataSource.transaction(async (manager) => {
            const receipt = await manager
                .createQueryBuilder(GoodsReceipt, 'goods_receipt')
                .setLock('pessimistic_write')
                .where('goods_receipt.id = :receiptId', { receiptId })
                .getOne();
            if (!receipt || receipt.status !== GoodsReceiptStatus.DRAFT) {
                throw new BadRequestException('Only draft goods receipts can be posted');
            }
            const items = await manager.find(GoodsReceiptItem, { where: { goods_receipt: { id: receipt.id } } });
            if (!items.length) {
                throw new BadRequestException('This goods receipt has no lines');
            }
            const variants = await this.productService.variantsForVendor(receipt.vendor_id, items.map((item) => item.product_variant_id));
            this.assertExpiry(variants, items);

            if (receipt.purchase_order_id) {
                await this.purchaseOrderService.lockForReceipt(manager, receipt.purchase_order_id);
                const orderItemIds = Array.from(new Set(items.map((item) => item.purchase_order_item_id)));
                const orderItems = await manager
                    .createQueryBuilder(PurchaseOrderItem, 'order_item')
                    .setLock('pessimistic_write')
                    .where({ id: In(orderItemIds) })
                    .getMany();
                for (const orderItem of orderItems) {
                    const receiving = roundQuantity(items
                        .filter((item) => item.purchase_order_item_id === orderItem.id)
                        .reduce((sum, item) => sum + item.quantity, 0));
                    const remaining = roundQuantity(orderItem.quantity - orderItem.received_quantity);
                    if (receiving > remaining) {
                        const variant = variants.get(orderItem.product_variant_id);
                        throw new BadRequestException(`${variant.product.name} (${variant.name}): receiving ${receiving} but only ${remaining} is still open on the purchase order`);
                    }
                    await manager.update(PurchaseOrderItem, orderItem.id, { received_quantity: roundQuantity(orderItem.received_quantity + receiving) });
                }
            }

            for (const item of items) {
                const variant = variants.get(item.product_variant_id);
                const totalQuantity = roundQuantity(item.quantity + (item.free_quantity || 0));
                const netAmount = item.quantity * item.unit_cost - (item.discount_amount || 0);
                const effectiveCost = roundCost(netAmount / totalQuantity);
                await this.stockService.applyMovement(manager, {
                    vendorId: receipt.vendor_id,
                    clientstoreId: receipt.clientstore_id,
                    variantId: item.product_variant_id,
                    type: StockMovementType.PURCHASE,
                    quantity: totalQuantity,
                    unitCost: effectiveCost,
                    batches: item.batch_number || item.expiry_date
                        ? [{ batch_number: item.batch_number, expiry_date: item.expiry_date, quantity: totalQuantity, unit_cost: effectiveCost }]
                        : [],
                    trackExpiry: variant.product.track_expiry,
                    allowNegative: true,
                    label: `${variant.product.name} (${variant.name})`,
                    reference: { type: 'goods_receipt', id: receipt.id, number: receipt.grn_number },
                    createdById: actor.id,
                });
                await manager.update(ProductVariant, item.product_variant_id, { cost_price: effectiveCost });
            }

            if (receipt.purchase_order_id) {
                await this.purchaseOrderService.refreshStatus(manager, receipt.purchase_order_id);
            }

            await manager.update(GoodsReceipt, receipt.id, {
                status: GoodsReceiptStatus.POSTED,
                posted_by: { id: actor.id },
                posted_at: new Date(),
            });
        });
    }
}
