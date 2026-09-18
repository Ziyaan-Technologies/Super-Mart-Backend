import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import * as moment from 'moment-timezone';
import { roundAmount, roundCost, roundQuantity } from 'src/common/decimal.transformer';
import { ProductVariant } from 'src/product/models/product-variant.entity';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { Stock } from './models/stock.entity';
import { StockBatch } from './models/stock-batch.entity';
import { INBOUND_MOVEMENTS, StockMovement, StockMovementType } from './models/stock-movement.entity';

export interface BatchAllocation {
    batch_number: string | null;
    expiry_date: string | null;
    quantity: number;
    unit_cost: number;
}

export interface MovementInput {
    vendorId: number;
    clientstoreId: number;
    variantId: number;
    type: StockMovementType;
    quantity: number;
    unitCost?: number;
    batches?: BatchAllocation[];
    trackExpiry?: boolean;
    batchId?: number;
    allowNegative: boolean;
    label?: string;
    reference?: { type: string; id: number; number: string };
    note?: string;
    createdById?: number | null;
}

export interface MovementResult {
    unitCost: number;
    balance: number;
    allocations: BatchAllocation[];
}

export interface StockListFilter {
    vendorId?: number;
    clientstoreId?: number | null;
    search?: string;
    categoryIds?: number[] | null;
    brandId?: number;
    stockStatus?: string;
}

@Injectable()
export class StockService {
    constructor(
        @InjectRepository(Stock, 'MainConnection') private readonly stockRepository: Repository<Stock>,
        @InjectRepository(StockBatch, 'MainConnection') private readonly batchRepository: Repository<StockBatch>,
        @InjectRepository(StockMovement, 'MainConnection') private readonly movementRepository: Repository<StockMovement>,
        @InjectRepository(ProductVariant, 'MainConnection') private readonly variantRepository: Repository<ProductVariant>,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
    ) {
    }

    transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
        return this.dataSource.transaction(work);
    }

    async allowNegativeStock(manager: EntityManager, vendorId: number): Promise<boolean> {
        const vendor = await manager.findOne(Vendor, { where: { id: vendorId } });
        return !!vendor?.allow_negative_stock;
    }

    async applyMovement(manager: EntityManager, input: MovementInput): Promise<MovementResult> {
        const quantity = roundQuantity(input.quantity);
        if (quantity <= 0) {
            throw new BadRequestException('Quantity must be greater than zero');
        }
        const inbound = INBOUND_MOVEMENTS.includes(input.type);

        await manager
            .createQueryBuilder()
            .insert()
            .into(Stock)
            .values({
                vendor: { id: input.vendorId },
                clientstore: { id: input.clientstoreId },
                product_variant: { id: input.variantId },
                quantity: 0,
                average_cost: 0,
            })
            .orIgnore()
            .updateEntity(false)
            .execute();

        const stock = await manager
            .createQueryBuilder(Stock, 'stock')
            .setLock('pessimistic_write')
            .where('stock.clientstore_id = :clientstoreId', { clientstoreId: input.clientstoreId })
            .andWhere('stock.product_variant_id = :variantId', { variantId: input.variantId })
            .getOne();

        let unitCost: number;
        let balance: number;
        let averageCost = stock.average_cost;
        let allocations: BatchAllocation[] = [];

        if (inbound) {
            unitCost = roundCost(input.unitCost ?? stock.average_cost);
            balance = roundQuantity(stock.quantity + quantity);
            if (stock.quantity <= 0 || balance <= 0) {
                averageCost = unitCost;
            } else {
                averageCost = roundCost((stock.quantity * stock.average_cost + quantity * unitCost) / balance);
            }
            const batches = input.batches?.length
                ? input.batches
                : input.trackExpiry
                    ? [{ batch_number: null, expiry_date: null, quantity, unit_cost: unitCost }]
                    : [];
            for (const batch of batches) {
                const batchQuantity = roundQuantity(batch.quantity);
                if (batchQuantity <= 0) {
                    continue;
                }
                await manager.save(StockBatch, {
                    vendor: { id: input.vendorId },
                    clientstore: { id: input.clientstoreId },
                    product_variant: { id: input.variantId },
                    batch_number: batch.batch_number || null,
                    expiry_date: batch.expiry_date || null,
                    received_quantity: batchQuantity,
                    quantity: batchQuantity,
                    unit_cost: roundCost(batch.unit_cost ?? unitCost),
                });
                allocations.push({ ...batch, quantity: batchQuantity });
            }
        } else {
            if (!input.allowNegative && stock.quantity < quantity) {
                throw new BadRequestException(`Not enough stock for ${input.label || 'this product'}. Available: ${stock.quantity}, required: ${quantity}`);
            }
            unitCost = stock.average_cost;
            balance = roundQuantity(stock.quantity - quantity);
            allocations = await this.consumeBatches(manager, input, quantity);
        }

        await manager.update(Stock, stock.id, { quantity: balance, average_cost: averageCost });

        await manager.save(StockMovement, {
            vendor: { id: input.vendorId },
            clientstore: { id: input.clientstoreId },
            product_variant: { id: input.variantId },
            stock_batch: input.batchId ? { id: input.batchId } : null,
            type: input.type,
            quantity: inbound ? quantity : -quantity,
            unit_cost: unitCost,
            balance_after: balance,
            reference_type: input.reference?.type || null,
            reference_id: input.reference?.id || null,
            reference_number: input.reference?.number || null,
            note: input.note || null,
            created_by: input.createdById ? { id: input.createdById } : null,
        });

        return { unitCost, balance, allocations };
    }

    private async consumeBatches(manager: EntityManager, input: MovementInput, quantity: number): Promise<BatchAllocation[]> {
        const query = manager
            .createQueryBuilder(StockBatch, 'batch')
            .setLock('pessimistic_write')
            .where('batch.clientstore_id = :clientstoreId', { clientstoreId: input.clientstoreId })
            .andWhere('batch.product_variant_id = :variantId', { variantId: input.variantId })
            .andWhere('batch.quantity > 0');
        if (input.batchId) {
            query.andWhere('batch.id = :batchId', { batchId: input.batchId });
        }
        const batches = await query
            .orderBy('ISNULL(batch.expiry_date)', 'ASC')
            .addOrderBy('batch.expiry_date', 'ASC')
            .addOrderBy('batch.id', 'ASC')
            .getMany();

        if (input.batchId && !batches.length) {
            throw new BadRequestException('The selected batch has no stock left');
        }

        let remaining = quantity;
        const allocations: BatchAllocation[] = [];
        for (const batch of batches) {
            if (remaining <= 0) {
                break;
            }
            const taken = Math.min(batch.quantity, remaining);
            await manager.update(StockBatch, batch.id, { quantity: roundQuantity(batch.quantity - taken) });
            allocations.push({
                batch_number: batch.batch_number,
                expiry_date: batch.expiry_date,
                quantity: roundQuantity(taken),
                unit_cost: batch.unit_cost,
            });
            remaining = roundQuantity(remaining - taken);
        }

        if (input.batchId && remaining > 0) {
            throw new BadRequestException(`The selected batch only has ${roundQuantity(quantity - remaining)} left`);
        }
        return allocations;
    }

    async lockedQuantity(manager: EntityManager, clientstoreId: number, variantId: number): Promise<number> {
        const stock = await manager
            .createQueryBuilder(Stock, 'stock')
            .setLock('pessimistic_write')
            .where('stock.clientstore_id = :clientstoreId', { clientstoreId })
            .andWhere('stock.product_variant_id = :variantId', { variantId })
            .getOne();
        return stock?.quantity || 0;
    }

    async stockQuantities(clientstoreId: number, variantIds: number[]): Promise<Map<number, Stock>> {
        if (!variantIds.length) {
            return new Map();
        }
        const rows = await this.stockRepository
            .createQueryBuilder('stock')
            .where('stock.clientstore_id = :clientstoreId', { clientstoreId })
            .andWhere('stock.product_variant_id IN (:...variantIds)', { variantIds })
            .getMany();
        return new Map(rows.map((row) => [row.product_variant_id, row]));
    }

    private stockQuery(filter: StockListFilter): SelectQueryBuilder<ProductVariant> {
        const query = this.variantRepository
            .createQueryBuilder('variant')
            .innerJoin('variant.product', 'product')
            .leftJoin('product.category', 'category')
            .leftJoin('product.brand', 'brand')
            .leftJoin('product.unit', 'unit')
            .where('variant.is_active = 1')
            .andWhere('product.is_active = 1');
        if (filter.clientstoreId) {
            query.leftJoin('stocks', 'stock', 'stock.product_variant_id = variant.id AND stock.clientstore_id = :clientstoreId', { clientstoreId: filter.clientstoreId });
        } else {
            query.leftJoin('stocks', 'stock', 'stock.product_variant_id = variant.id');
        }
        if (filter.vendorId) {
            query.andWhere('variant.vendor_id = :vendorId', { vendorId: filter.vendorId });
        }
        if (filter.categoryIds?.length) {
            query.andWhere('product.category_id IN (:...categoryIds)', { categoryIds: filter.categoryIds });
        }
        if (filter.brandId) {
            query.andWhere('product.brand_id = :brandId', { brandId: filter.brandId });
        }
        if (filter.search) {
            query.andWhere('(product.name LIKE :search OR variant.name LIKE :search OR variant.sku LIKE :search OR variant.barcode LIKE :search)', { search: `%${filter.search}%` });
        }
        query.groupBy('variant.id');
        const quantityExpression = 'COALESCE(SUM(stock.quantity), 0)';
        if (filter.stockStatus === 'out') {
            query.having(`${quantityExpression} <= 0`);
        } else if (filter.stockStatus === 'low') {
            query.having(`${quantityExpression} > 0 AND ${quantityExpression} <= MAX(variant.reorder_level)`);
        } else if (filter.stockStatus === 'in') {
            query.having(`${quantityExpression} > 0`);
        }
        return query;
    }

    async stockList(filter: StockListFilter, page: number, take: number, sortBy?: string) {
        const countRow = await this.dataSource
            .createQueryBuilder()
            .select('COUNT(*)', 'total')
            .from(`(${this.stockQuery(filter).select('variant.id', 'id').getQuery()})`, 'rows')
            .setParameters(this.stockQuery(filter).getParameters())
            .getRawOne();
        const total = Number(countRow?.total || 0);
        const sortColumns: Record<string, string> = {
            'Newest': 'variant.id DESC',
            'Oldest': 'variant.id ASC',
            'Quantity Low': 'quantity ASC',
            'Quantity High': 'quantity DESC',
            'Name': 'product_name ASC',
        };
        const [sortField, sortDirection] = (sortColumns[sortBy] || 'product_name ASC').split(' ');
        const rows = await this.stockQuery(filter)
            .select([
                'variant.id AS product_variant_id',
                'variant.name AS variant_name',
                'variant.sku AS sku',
                'variant.barcode AS barcode',
                'variant.sale_price AS sale_price',
                'variant.cost_price AS cost_price',
                'variant.reorder_level AS reorder_level',
                'product.id AS product_id',
                'product.name AS product_name',
                'product.image_url AS image_url',
                'product.track_expiry AS track_expiry',
                'product.is_weighted AS is_weighted',
                'category.name AS category_name',
                'brand.name AS brand_name',
                'unit.short_name AS unit_short_name',
            ])
            .addSelect('COALESCE(SUM(stock.quantity), 0)', 'quantity')
            .addSelect('COALESCE(SUM(stock.quantity * stock.average_cost), 0)', 'stock_value')
            .orderBy(sortField, sortDirection as 'ASC' | 'DESC')
            .offset((page - 1) * take)
            .limit(take)
            .getRawMany();
        const data = rows.map((row) => {
            const quantity = roundQuantity(parseFloat(row.quantity));
            const reorderLevel = parseFloat(row.reorder_level);
            const stockValue = roundAmount(parseFloat(row.stock_value));
            return {
                ...row,
                sale_price: parseFloat(row.sale_price),
                cost_price: parseFloat(row.cost_price),
                reorder_level: reorderLevel,
                track_expiry: Boolean(Number(row.track_expiry)),
                is_weighted: Boolean(Number(row.is_weighted)),
                stock_unit: Number(row.is_weighted) ? row.unit_short_name : 'pcs',
                quantity,
                stock_value: stockValue,
                average_cost: quantity > 0 ? roundCost(stockValue / quantity) : parseFloat(row.cost_price),
                stock_status: quantity <= 0 ? 'Out of Stock' : quantity <= reorderLevel ? 'Low Stock' : 'In Stock',
            };
        });
        return {
            data,
            meta: {
                total,
                page: Math.ceil(page),
                last_page: Math.ceil(total / take),
            },
        };
    }

    async stockKpis(filter: StockListFilter) {
        const summary = await this.dataSource
            .createQueryBuilder()
            .select('COUNT(*)', 'sku_count')
            .addSelect('COALESCE(SUM(rows.stock_value), 0)', 'stock_value')
            .addSelect('SUM(CASE WHEN rows.quantity <= 0 THEN 1 ELSE 0 END)', 'out_of_stock')
            .addSelect('SUM(CASE WHEN rows.quantity > 0 AND rows.quantity <= rows.reorder_level THEN 1 ELSE 0 END)', 'low_stock')
            .from(`(${this.stockQuery({ ...filter, stockStatus: undefined })
                .select('variant.id', 'id')
                .addSelect('COALESCE(SUM(stock.quantity), 0)', 'quantity')
                .addSelect('COALESCE(SUM(stock.quantity * stock.average_cost), 0)', 'stock_value')
                .addSelect('MAX(variant.reorder_level)', 'reorder_level')
                .getQuery()})`, 'rows')
            .setParameters(this.stockQuery(filter).getParameters())
            .getRawOne();

        const today = moment().format('YYYY-MM-DD');
        const soon = moment().add(30, 'days').format('YYYY-MM-DD');
        const batchQuery = () => {
            const query = this.batchRepository
                .createQueryBuilder('batch')
                .where('batch.quantity > 0')
                .andWhere('batch.expiry_date IS NOT NULL');
            if (filter.vendorId) {
                query.andWhere('batch.vendor_id = :vendorId', { vendorId: filter.vendorId });
            }
            if (filter.clientstoreId) {
                query.andWhere('batch.clientstore_id = :clientstoreId', { clientstoreId: filter.clientstoreId });
            }
            return query;
        };
        const expired = await batchQuery().andWhere('batch.expiry_date < :today', { today }).getCount();
        const expiringSoon = await batchQuery().andWhere('batch.expiry_date BETWEEN :today AND :soon', { today, soon }).getCount();

        return {
            skuCount: Number(summary?.sku_count || 0),
            stockValue: roundAmount(parseFloat(summary?.stock_value || 0)),
            lowStock: Number(summary?.low_stock || 0),
            outOfStock: Number(summary?.out_of_stock || 0),
            expiringSoon,
            expired,
        };
    }

    async movements(filter: { vendorId?: number; clientstoreId?: number | null; variantId?: number; type?: string; search?: string; startDate?: string; endDate?: string }, page: number, take: number) {
        const query = this.movementRepository
            .createQueryBuilder('movement')
            .leftJoinAndSelect('movement.product_variant', 'variant')
            .leftJoinAndSelect('variant.product', 'product')
            .leftJoinAndSelect('movement.clientstore', 'clientstore')
            .leftJoinAndSelect('movement.stock_batch', 'batch')
            .leftJoin('movement.created_by', 'created_by')
            .addSelect(['created_by.id', 'created_by.full_name']);
        if (filter.vendorId) {
            query.andWhere('movement.vendor_id = :vendorId', { vendorId: filter.vendorId });
        }
        if (filter.clientstoreId) {
            query.andWhere('movement.clientstore_id = :clientstoreId', { clientstoreId: filter.clientstoreId });
        }
        if (filter.variantId) {
            query.andWhere('movement.product_variant_id = :variantId', { variantId: filter.variantId });
        }
        if (filter.type) {
            query.andWhere('movement.type = :type', { type: filter.type });
        }
        if (filter.search) {
            query.andWhere('(product.name LIKE :search OR variant.sku LIKE :search OR variant.barcode LIKE :search OR movement.reference_number LIKE :search)', { search: `%${filter.search}%` });
        }
        if (filter.startDate && filter.endDate) {
            query.andWhere('movement.created_at BETWEEN :startDate AND :endDate', {
                startDate: moment(new Date(filter.startDate)).startOf('day').toDate(),
                endDate: moment(new Date(filter.endDate)).endOf('day').toDate(),
            });
        }
        const [data, total] = await query
            .orderBy('movement.id', 'DESC')
            .skip((page - 1) * take)
            .take(take)
            .getManyAndCount();
        return {
            data,
            meta: {
                total,
                page: Math.ceil(page),
                last_page: Math.ceil(total / take),
            },
        };
    }

    async expiringBatches(filter: { vendorId?: number; clientstoreId?: number | null; days: number; search?: string; includeExpired: boolean }, page: number, take: number) {
        const today = moment().format('YYYY-MM-DD');
        const until = moment().add(filter.days, 'days').format('YYYY-MM-DD');
        const query = this.batchRepository
            .createQueryBuilder('batch')
            .leftJoinAndSelect('batch.product_variant', 'variant')
            .leftJoinAndSelect('variant.product', 'product')
            .leftJoinAndSelect('batch.clientstore', 'clientstore')
            .where('batch.quantity > 0')
            .andWhere('batch.expiry_date IS NOT NULL')
            .andWhere('batch.expiry_date <= :until', { until });
        if (!filter.includeExpired) {
            query.andWhere('batch.expiry_date >= :today', { today });
        }
        if (filter.vendorId) {
            query.andWhere('batch.vendor_id = :vendorId', { vendorId: filter.vendorId });
        }
        if (filter.clientstoreId) {
            query.andWhere('batch.clientstore_id = :clientstoreId', { clientstoreId: filter.clientstoreId });
        }
        if (filter.search) {
            query.andWhere('(product.name LIKE :search OR variant.sku LIKE :search OR batch.batch_number LIKE :search)', { search: `%${filter.search}%` });
        }
        const [rows, total] = await query
            .orderBy('batch.expiry_date', 'ASC')
            .addOrderBy('batch.id', 'ASC')
            .skip((page - 1) * take)
            .take(take)
            .getManyAndCount();
        const data = rows.map((batch) => ({
            ...batch,
            days_left: moment(batch.expiry_date).diff(moment(today), 'days'),
            stock_value: roundAmount(batch.quantity * batch.unit_cost),
        }));
        return {
            data,
            meta: {
                total,
                page: Math.ceil(page),
                last_page: Math.ceil(total / take),
            },
        };
    }

    async variantStock(vendorId: number | undefined, variantId: number, clientstoreId?: number | null) {
        const stockQuery = this.stockRepository
            .createQueryBuilder('stock')
            .leftJoinAndSelect('stock.clientstore', 'clientstore')
            .where('stock.product_variant_id = :variantId', { variantId });
        const batchQuery = this.batchRepository
            .createQueryBuilder('batch')
            .leftJoinAndSelect('batch.clientstore', 'clientstore')
            .where('batch.product_variant_id = :variantId', { variantId })
            .andWhere('batch.quantity > 0');
        if (vendorId) {
            stockQuery.andWhere('stock.vendor_id = :vendorId', { vendorId });
            batchQuery.andWhere('batch.vendor_id = :vendorId', { vendorId });
        }
        if (clientstoreId) {
            stockQuery.andWhere('stock.clientstore_id = :clientstoreId', { clientstoreId });
            batchQuery.andWhere('batch.clientstore_id = :clientstoreId', { clientstoreId });
        }
        return {
            stores: await stockQuery.orderBy('clientstore.store_name', 'ASC').getMany(),
            batches: await batchQuery.orderBy('ISNULL(batch.expiry_date)', 'ASC').addOrderBy('batch.expiry_date', 'ASC').getMany(),
        };
    }

    async availableBatches(clientstoreId: number, variantId: number) {
        return this.batchRepository
            .createQueryBuilder('batch')
            .where('batch.clientstore_id = :clientstoreId', { clientstoreId })
            .andWhere('batch.product_variant_id = :variantId', { variantId })
            .andWhere('batch.quantity > 0')
            .orderBy('ISNULL(batch.expiry_date)', 'ASC')
            .addOrderBy('batch.expiry_date', 'ASC')
            .getMany();
    }
}
