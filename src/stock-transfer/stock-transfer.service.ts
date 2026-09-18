import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { ActorType, AuthActor } from 'src/common/auth-actor';
import { documentNumber } from 'src/common/document-number';
import { roundAmount, roundQuantity } from 'src/common/decimal.transformer';
import { assertStoreDocumentAccess } from 'src/common/tenant-scope';
import { ProductService } from 'src/product/product.service';
import { ClientstoreService } from 'src/clientstore/clientstore.service';
import { StockService, BatchAllocation } from 'src/stock/stock.service';
import { StockMovementType } from 'src/stock/models/stock-movement.entity';
import { StockTransfer, StockTransferStatus } from './models/stock-transfer.entity';
import { StockTransferItem } from './models/stock-transfer-item.entity';
import { StockTransferCreateDto, StockTransferItemDto, StockTransferReceiveDto, StockTransferUpdateDto } from './models/stock-transfer.dto';

@Injectable()
export class StockTransferService extends AbstractService {
    constructor(
        @InjectRepository(StockTransfer, 'MainConnection') private readonly transferRepository: Repository<StockTransfer>,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
        private productService: ProductService,
        private clientstoreService: ClientstoreService,
        private stockService: StockService,
    ) {
        super(transferRepository);
    }

    readonly detailRelations = ['from_clientstore', 'to_clientstore', 'items', 'items.product_variant', 'items.product_variant.product', 'items.product_variant.product.unit', 'created_by', 'dispatched_by', 'received_by'];

    async accessible(actor: AuthActor, id: number, relations: string[] = []): Promise<StockTransfer> {
        const transfer = await this.transferRepository.findOne({ where: { id }, relations });
        if (!transfer) {
            throw new NotFoundException('Stock transfer not found');
        }
        assertStoreDocumentAccess(actor, transfer.vendor_id, [transfer.from_clientstore_id, transfer.to_clientstore_id]);
        return transfer;
    }

    private assertStoreRole(actor: AuthActor, clientstoreId: number, role: string) {
        if (actor.type === ActorType.CLIENT && actor.clientstore_id && actor.clientstore_id !== Number(clientstoreId)) {
            throw new ForbiddenException(`Only staff of the ${role} store can do this`);
        }
    }

    private async validate(actor: AuthActor, vendorId: number, fromId: number, toId: number, items: StockTransferItemDto[]) {
        if (Number(fromId) === Number(toId)) {
            throw new BadRequestException('Source and destination stores must be different');
        }
        this.assertStoreRole(actor, fromId, 'source');
        await this.clientstoreService.assertBelongsToVendor(fromId, vendorId);
        await this.clientstoreService.assertBelongsToVendor(toId, vendorId);
        const variantIds = items.map((item) => item.product_variant_id);
        if (new Set(variantIds).size !== variantIds.length) {
            throw new BadRequestException('Each product can only appear once in a transfer');
        }
        await this.productService.variantsForVendor(vendorId, variantIds);
    }

    private async saveItems(manager: EntityManager, transferId: number, items: StockTransferItemDto[]) {
        await manager.save(StockTransferItem, items.map((item) => ({
            stock_transfer: { id: transferId },
            product_variant: { id: item.product_variant_id },
            quantity: item.quantity,
        })));
    }

    async createTransfer(actor: AuthActor, vendorId: number, body: StockTransferCreateDto) {
        await this.validate(actor, vendorId, body.from_clientstore_id, body.to_clientstore_id, body.items);
        return this.dataSource.transaction(async (manager) => {
            const transfer = await manager.save(StockTransfer, {
                vendor: { id: vendorId },
                from_clientstore: { id: body.from_clientstore_id },
                to_clientstore: { id: body.to_clientstore_id },
                transfer_date: body.transfer_date,
                note: body.note || null,
                status: StockTransferStatus.DRAFT,
                created_by: { id: actor.id },
            });
            await manager.update(StockTransfer, transfer.id, { transfer_number: documentNumber('TRF', transfer.id) });
            await this.saveItems(manager, transfer.id, body.items);
            return transfer;
        });
    }

    async updateTransfer(actor: AuthActor, transfer: StockTransfer, body: StockTransferUpdateDto) {
        if (transfer.status !== StockTransferStatus.DRAFT) {
            throw new BadRequestException('Only draft transfers can be edited');
        }
        const fromId = body.from_clientstore_id ?? transfer.from_clientstore_id;
        const toId = body.to_clientstore_id ?? transfer.to_clientstore_id;
        const items = body.items || (await this.dataSource.getRepository(StockTransferItem).find({ where: { stock_transfer: { id: transfer.id } } }))
            .map((item) => ({ product_variant_id: item.product_variant_id, quantity: item.quantity }));
        await this.validate(actor, transfer.vendor_id, fromId, toId, items);
        await this.dataSource.transaction(async (manager) => {
            const changes: any = {};
            if (body.from_clientstore_id) changes.from_clientstore = { id: body.from_clientstore_id };
            if (body.to_clientstore_id) changes.to_clientstore = { id: body.to_clientstore_id };
            if (body.transfer_date) changes.transfer_date = body.transfer_date;
            if (body.note !== undefined) changes.note = body.note || null;
            if (Object.keys(changes).length) {
                await manager.update(StockTransfer, transfer.id, changes);
            }
            if (body.items) {
                const existing = await manager.find(StockTransferItem, { where: { stock_transfer: { id: transfer.id } } });
                if (existing.length) {
                    await manager.delete(StockTransferItem, existing.map((item) => item.id));
                }
                await this.saveItems(manager, transfer.id, body.items);
            }
        });
    }

    private async lock(manager: EntityManager, transferId: number, status: StockTransferStatus, message: string) {
        const transfer = await manager
            .createQueryBuilder(StockTransfer, 'stock_transfer')
            .setLock('pessimistic_write')
            .where('stock_transfer.id = :transferId', { transferId })
            .getOne();
        if (!transfer || transfer.status !== status) {
            throw new BadRequestException(message);
        }
        return transfer;
    }

    async dispatch(actor: AuthActor, transferId: number) {
        await this.dataSource.transaction(async (manager) => {
            const transfer = await this.lock(manager, transferId, StockTransferStatus.DRAFT, 'Only draft transfers can be dispatched');
            this.assertStoreRole(actor, transfer.from_clientstore_id, 'source');
            const items = await manager.find(StockTransferItem, { where: { stock_transfer: { id: transfer.id } } });
            const variants = await this.productService.variantsForVendor(transfer.vendor_id, items.map((item) => item.product_variant_id));
            const allowNegative = await this.stockService.allowNegativeStock(manager, transfer.vendor_id);
            let totalValue = 0;
            for (const item of items) {
                const variant = variants.get(item.product_variant_id);
                const result = await this.stockService.applyMovement(manager, {
                    vendorId: transfer.vendor_id,
                    clientstoreId: transfer.from_clientstore_id,
                    variantId: item.product_variant_id,
                    type: StockMovementType.TRANSFER_OUT,
                    quantity: item.quantity,
                    allowNegative,
                    label: `${variant.product.name} (${variant.name})`,
                    reference: { type: 'stock_transfer', id: transfer.id, number: transfer.transfer_number },
                    createdById: actor.id,
                });
                totalValue += item.quantity * result.unitCost;
                await manager.update(StockTransferItem, item.id, {
                    unit_cost: result.unitCost,
                    batch_allocations: result.allocations,
                });
            }
            await manager.update(StockTransfer, transfer.id, {
                status: StockTransferStatus.DISPATCHED,
                total_value: roundAmount(totalValue),
                dispatched_by: { id: actor.id },
                dispatched_at: new Date(),
            });
        });
    }

    private receivedBatches(allocations: BatchAllocation[] | null, receivedQuantity: number): BatchAllocation[] {
        let remaining = receivedQuantity;
        const batches: BatchAllocation[] = [];
        for (const allocation of allocations || []) {
            if (remaining <= 0) {
                break;
            }
            const quantity = Math.min(allocation.quantity, remaining);
            batches.push({ ...allocation, quantity: roundQuantity(quantity) });
            remaining = roundQuantity(remaining - quantity);
        }
        return batches;
    }

    async receive(actor: AuthActor, transferId: number, body: StockTransferReceiveDto) {
        await this.dataSource.transaction(async (manager) => {
            const transfer = await this.lock(manager, transferId, StockTransferStatus.DISPATCHED, 'Only dispatched transfers can be received');
            this.assertStoreRole(actor, transfer.to_clientstore_id, 'destination');
            const items = await manager.find(StockTransferItem, { where: { stock_transfer: { id: transfer.id } } });
            const variants = await this.productService.variantsForVendor(transfer.vendor_id, items.map((item) => item.product_variant_id));
            const shortages: string[] = [];
            for (const item of items) {
                const override = body.items?.find((row) => row.id === item.id);
                const received = roundQuantity(override ? override.received_quantity : item.quantity);
                const variant = variants.get(item.product_variant_id);
                if (received > item.quantity) {
                    throw new BadRequestException(`${variant.product.name}: received quantity cannot be more than dispatched (${item.quantity})`);
                }
                if (received > 0) {
                    await this.stockService.applyMovement(manager, {
                        vendorId: transfer.vendor_id,
                        clientstoreId: transfer.to_clientstore_id,
                        variantId: item.product_variant_id,
                        type: StockMovementType.TRANSFER_IN,
                        quantity: received,
                        unitCost: item.unit_cost,
                        batches: this.receivedBatches(item.batch_allocations, received),
                        trackExpiry: variant.product.track_expiry,
                        allowNegative: true,
                        label: `${variant.product.name} (${variant.name})`,
                        reference: { type: 'stock_transfer', id: transfer.id, number: transfer.transfer_number },
                        createdById: actor.id,
                    });
                }
                if (received < item.quantity) {
                    shortages.push(`${variant.product.name} (${variant.name}): short by ${roundQuantity(item.quantity - received)}`);
                }
                await manager.update(StockTransferItem, item.id, { received_quantity: received });
            }
            const notes = [body.receive_note, ...shortages].filter(Boolean).join('\n');
            await manager.update(StockTransfer, transfer.id, {
                status: StockTransferStatus.RECEIVED,
                receive_note: notes || null,
                received_by: { id: actor.id },
                received_at: new Date(),
            });
        });
    }

    async cancel(transfer: StockTransfer) {
        if (transfer.status !== StockTransferStatus.DRAFT) {
            throw new BadRequestException('Only draft transfers can be cancelled');
        }
        await this.transferRepository.update(transfer.id, { status: StockTransferStatus.CANCELLED });
    }
}
