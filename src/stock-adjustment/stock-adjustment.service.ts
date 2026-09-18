import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { AuthActor } from 'src/common/auth-actor';
import { documentNumber } from 'src/common/document-number';
import { roundAmount, roundQuantity } from 'src/common/decimal.transformer';
import { assertStoreDocumentAccess } from 'src/common/tenant-scope';
import { ProductService } from 'src/product/product.service';
import { ClientstoreService } from 'src/clientstore/clientstore.service';
import { StockService } from 'src/stock/stock.service';
import { StockMovementType } from 'src/stock/models/stock-movement.entity';
import { StockBatch } from 'src/stock/models/stock-batch.entity';
import { AdjustmentReason, StockAdjustment, StockAdjustmentStatus } from './models/stock-adjustment.entity';
import { StockAdjustmentItem } from './models/stock-adjustment-item.entity';
import { StockAdjustmentCreateDto, StockAdjustmentItemDto, StockAdjustmentUpdateDto } from './models/stock-adjustment.dto';

@Injectable()
export class StockAdjustmentService extends AbstractService {
    constructor(
        @InjectRepository(StockAdjustment, 'MainConnection') private readonly adjustmentRepository: Repository<StockAdjustment>,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
        private productService: ProductService,
        private clientstoreService: ClientstoreService,
        private stockService: StockService,
    ) {
        super(adjustmentRepository);
    }

    readonly detailRelations = ['clientstore', 'items', 'items.product_variant', 'items.product_variant.product', 'items.product_variant.product.unit', 'items.stock_batch', 'created_by', 'posted_by'];

    async accessible(actor: AuthActor, id: number, relations: string[] = []): Promise<StockAdjustment> {
        const adjustment = await this.adjustmentRepository.findOne({ where: { id }, relations });
        if (!adjustment) {
            throw new NotFoundException('Stock adjustment not found');
        }
        assertStoreDocumentAccess(actor, adjustment.vendor_id, [adjustment.clientstore_id]);
        return adjustment;
    }

    private async validate(actor: AuthActor, vendorId: number, clientstoreId: number, reason: AdjustmentReason, items: StockAdjustmentItemDto[]) {
        await this.clientstoreService.accessible(actor, clientstoreId);
        const variants = await this.productService.variantsForVendor(vendorId, items.map((item) => item.product_variant_id));
        for (const item of items) {
            const variant = variants.get(item.product_variant_id);
            const label = `${variant.product.name} (${variant.name})`;
            if (reason === AdjustmentReason.COUNT_CORRECTION) {
                if (item.counted_quantity === undefined || item.counted_quantity === null) {
                    throw new BadRequestException(`${label}: counted quantity is required for a count correction`);
                }
            } else if (!item.quantity) {
                throw new BadRequestException(`${label}: quantity cannot be zero`);
            } else if (reason !== AdjustmentReason.OTHER && item.quantity > 0) {
                throw new BadRequestException(`${label}: ${reason} can only reduce stock. Use a negative quantity.`);
            }
            if (item.stock_batch_id) {
                const batch = await this.dataSource.getRepository(StockBatch).findOne({ where: { id: item.stock_batch_id } });
                if (!batch || batch.clientstore_id !== Number(clientstoreId) || batch.product_variant_id !== Number(item.product_variant_id)) {
                    throw new BadRequestException(`${label}: the selected batch is not valid`);
                }
            }
            if ((item.quantity || 0) > 0 && variant.product.track_expiry && !item.expiry_date) {
                throw new BadRequestException(`${label}: expiry date is required when adding stock`);
            }
        }
    }

    private async saveItems(manager: EntityManager, adjustmentId: number, reason: AdjustmentReason, items: StockAdjustmentItemDto[]) {
        await manager.save(StockAdjustmentItem, items.map((item) => ({
            stock_adjustment: { id: adjustmentId },
            product_variant: { id: item.product_variant_id },
            stock_batch: item.stock_batch_id ? { id: item.stock_batch_id } : null,
            quantity: reason === AdjustmentReason.COUNT_CORRECTION ? 0 : item.quantity,
            counted_quantity: reason === AdjustmentReason.COUNT_CORRECTION ? item.counted_quantity : null,
            unit_cost: item.unit_cost ?? null,
            batch_number: item.batch_number || null,
            expiry_date: item.expiry_date || null,
        })));
    }

    async createAdjustment(actor: AuthActor, vendorId: number, body: StockAdjustmentCreateDto) {
        await this.validate(actor, vendorId, body.clientstore_id, body.reason, body.items);
        return this.dataSource.transaction(async (manager) => {
            const adjustment = await manager.save(StockAdjustment, {
                vendor: { id: vendorId },
                clientstore: { id: body.clientstore_id },
                adjustment_date: body.adjustment_date,
                reason: body.reason,
                note: body.note || null,
                status: StockAdjustmentStatus.DRAFT,
                created_by: { id: actor.id },
            });
            await manager.update(StockAdjustment, adjustment.id, { adjustment_number: documentNumber('ADJ', adjustment.id) });
            await this.saveItems(manager, adjustment.id, body.reason, body.items);
            return adjustment;
        });
    }

    async updateAdjustment(actor: AuthActor, adjustment: StockAdjustment, body: StockAdjustmentUpdateDto) {
        if (adjustment.status !== StockAdjustmentStatus.DRAFT) {
            throw new BadRequestException('Only draft adjustments can be edited');
        }
        const clientstoreId = body.clientstore_id ?? adjustment.clientstore_id;
        const reason = body.reason ?? adjustment.reason;
        if ((body.clientstore_id || body.reason) && !body.items) {
            throw new BadRequestException('Send the lines again when changing the store or reason');
        }
        if (body.items) {
            await this.validate(actor, adjustment.vendor_id, clientstoreId, reason, body.items);
        }
        await this.dataSource.transaction(async (manager) => {
            const changes: any = {};
            if (body.clientstore_id) changes.clientstore = { id: body.clientstore_id };
            if (body.reason) changes.reason = body.reason;
            if (body.adjustment_date) changes.adjustment_date = body.adjustment_date;
            if (body.note !== undefined) changes.note = body.note || null;
            if (Object.keys(changes).length) {
                await manager.update(StockAdjustment, adjustment.id, changes);
            }
            if (body.items) {
                const existing = await manager.find(StockAdjustmentItem, { where: { stock_adjustment: { id: adjustment.id } } });
                if (existing.length) {
                    await manager.delete(StockAdjustmentItem, existing.map((item) => item.id));
                }
                await this.saveItems(manager, adjustment.id, reason, body.items);
            }
        });
    }

    private movementType(reason: AdjustmentReason, quantity: number) {
        if (quantity > 0) {
            return StockMovementType.ADJUSTMENT_IN;
        }
        if ([AdjustmentReason.DAMAGE, AdjustmentReason.EXPIRY].includes(reason)) {
            return StockMovementType.WASTAGE;
        }
        return StockMovementType.ADJUSTMENT_OUT;
    }

    async post(actor: AuthActor, adjustmentId: number) {
        await this.dataSource.transaction(async (manager) => {
            const adjustment = await manager
                .createQueryBuilder(StockAdjustment, 'stock_adjustment')
                .setLock('pessimistic_write')
                .where('stock_adjustment.id = :adjustmentId', { adjustmentId })
                .getOne();
            if (!adjustment || adjustment.status !== StockAdjustmentStatus.DRAFT) {
                throw new BadRequestException('Only draft adjustments can be posted');
            }
            const items = await manager.find(StockAdjustmentItem, { where: { stock_adjustment: { id: adjustment.id } } });
            if (!items.length) {
                throw new BadRequestException('This adjustment has no lines');
            }
            const variants = await this.productService.variantsForVendor(adjustment.vendor_id, items.map((item) => item.product_variant_id));
            const allowNegative = await this.stockService.allowNegativeStock(manager, adjustment.vendor_id);
            let totalValue = 0;
            for (const item of items) {
                const variant = variants.get(item.product_variant_id);
                let quantity = item.quantity;
                let systemQuantity = null;
                if (adjustment.reason === AdjustmentReason.COUNT_CORRECTION) {
                    systemQuantity = await this.stockService.lockedQuantity(manager, adjustment.clientstore_id, item.product_variant_id);
                    quantity = roundQuantity(item.counted_quantity - systemQuantity);
                }
                let unitCost = item.unit_cost;
                if (quantity !== 0) {
                    const result = await this.stockService.applyMovement(manager, {
                        vendorId: adjustment.vendor_id,
                        clientstoreId: adjustment.clientstore_id,
                        variantId: item.product_variant_id,
                        type: this.movementType(adjustment.reason, quantity),
                        quantity: Math.abs(quantity),
                        unitCost: quantity > 0 ? item.unit_cost ?? undefined : undefined,
                        batchId: quantity < 0 ? item.stock_batch_id : undefined,
                        batches: quantity > 0 && (item.batch_number || item.expiry_date)
                            ? [{ batch_number: item.batch_number, expiry_date: item.expiry_date, quantity: Math.abs(quantity), unit_cost: item.unit_cost ?? variant.cost_price }]
                            : [],
                        trackExpiry: quantity > 0 && variant.product.track_expiry,
                        allowNegative: allowNegative || quantity > 0,
                        label: `${variant.product.name} (${variant.name})`,
                        reference: { type: 'stock_adjustment', id: adjustment.id, number: adjustment.adjustment_number },
                        note: adjustment.reason,
                        createdById: actor.id,
                    });
                    unitCost = result.unitCost;
                }
                const lineValue = roundAmount(quantity * (unitCost || 0));
                totalValue += lineValue;
                await manager.update(StockAdjustmentItem, item.id, {
                    quantity,
                    system_quantity: systemQuantity,
                    unit_cost: unitCost ?? 0,
                    line_value: lineValue,
                });
            }
            await manager.update(StockAdjustment, adjustment.id, {
                status: StockAdjustmentStatus.POSTED,
                total_value: roundAmount(totalValue),
                posted_by: { id: actor.id },
                posted_at: new Date(),
            });
        });
    }
}
