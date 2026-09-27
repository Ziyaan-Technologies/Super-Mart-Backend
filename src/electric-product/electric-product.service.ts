import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuthActor } from 'src/common/auth-actor';
import { paginateQuery } from 'src/common/document-list';
import { roundAmount, roundQuantity } from 'src/common/decimal.transformer';
import { ElectricListDto } from 'src/common/electric.dto';
import { ElectricAccessService } from 'src/electric-access/electric-access.service';
import { ElectricBrand } from 'src/electric-brand/models/electric-brand.entity';
import { ElectricCategory } from 'src/electric-category/models/electric-category.entity';
import { ElectricProduct } from './models/electric-product.entity';
import { ElectricProductVariant } from './models/electric-product-variant.entity';
import { ElectricStockEntry, ElectricStockEntryType } from './models/electric-stock-entry.entity';
import { ElectricProductDto, ElectricStockDto } from './models/electric-product.dto';

@Injectable()
export class ElectricProductService {
    constructor(
        private access: ElectricAccessService,
        @InjectRepository(ElectricBrand, 'MainConnection') private readonly brandRepository: Repository<ElectricBrand>,
        @InjectRepository(ElectricCategory, 'MainConnection') private readonly categoryRepository: Repository<ElectricCategory>,
        @InjectRepository(ElectricProduct, 'MainConnection') private readonly productRepository: Repository<ElectricProduct>,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
    ) { }

    productView(product: ElectricProduct) {
        const variants = [...(product.variants || [])].sort((a, b) => a.id - b.id);
        return {
            ...product,
            variants,
            brand: product.brand ? { id: product.brand.id, name: product.brand.name, image_url: product.brand.image_url } : null,
            category: product.category ? { id: product.category.id, name: product.category.name } : null,
            stock_total: roundQuantity(variants.reduce((sum, variant) => sum + variant.stock, 0)),
        };
    }

    private productQuery(shopId: number, body: ElectricListDto) {
        const query = this.productRepository.createQueryBuilder('product')
            .leftJoinAndSelect('product.variants', 'variant')
            .leftJoinAndSelect('product.brand', 'brand')
            .leftJoinAndSelect('product.category', 'category')
            .where('product.clientstore_id = :shopId', { shopId });
        if (body.search) {
            query.andWhere(`(product.name LIKE :search OR CAST(product.number AS CHAR) LIKE :search
                OR product.id IN (SELECT inner_variant.product_id FROM electric_product_variants inner_variant
                WHERE inner_variant.name LIKE :search OR inner_variant.barcode LIKE :search))`, { search: `%${body.search}%` });
        }
        if (body.category_id) query.andWhere('product.category_id = :categoryId', { categoryId: Number(body.category_id) });
        if (body.brand_id) query.andWhere('product.brand_id = :brandId', { brandId: Number(body.brand_id) });
        if (body.status) query.andWhere('product.is_active = :active', { active: body.status === 'Active' });
        return query;
    }

    async listProducts(actor: AuthActor, body: ElectricListDto) {
        const shop = await this.access.shop(actor, body.clientstore_id);
        const query = this.productQuery(shop.id, body).orderBy('product.id', 'DESC');
        const result = await paginateQuery(query, Number(body.page) || 1, Number(body.take) || 10);
        return { ...result, data: result.data.map((product: ElectricProduct) => this.productView(product)) };
    }

    async productKpis(actor: AuthActor, body: ElectricListDto) {
        const shop = await this.access.shop(actor, body.clientstore_id);
        const products = await this.productQuery(shop.id, {}).getMany();
        return {
            totalProducts: products.length,
            activeProducts: products.filter((product) => product.is_active).length,
            inactiveProducts: products.filter((product) => !product.is_active).length,
            lowStock: products.flatMap((product) => product.variants).filter((variant) => variant.is_active && variant.stock <= variant.reorder_level).length,
        };
    }

    async product(actor: AuthActor, id: number) {
        const product = await this.productRepository.findOne({ where: { id }, relations: ['variants', 'brand', 'category'] });
        if (!product) {
            throw new NotFoundException('Product not found');
        }
        await this.access.shop(actor, product.clientstore_id);
        return this.productView(product);
    }

    private async usedVariantIds(variantIds: number[]) {
        if (!variantIds.length) return new Set<number>();
        const rows = await this.dataSource.query(
            `SELECT DISTINCT variant_id AS id FROM electric_sale_items WHERE variant_id IN (?) UNION SELECT DISTINCT variant_id FROM electric_quotation_items WHERE variant_id IN (?)`,
            [variantIds, variantIds],
        );
        return new Set<number>(rows.map((row: any) => Number(row.id)));
    }

    private cleanNumber(value: any) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const number = Number(value);
        if (!Number.isInteger(number) || number < 1) {
            throw new BadRequestException('The number must be a whole number above zero');
        }
        return number;
    }

    private async assertFreeNumber(vendorId: number, value: any, productId?: number) {
        const number = this.cleanNumber(value);
        if (number === null) {
            return null;
        }
        const taken = await this.productRepository.createQueryBuilder('product')
            .leftJoinAndSelect('product.clientstore', 'clientstore')
            .where('product.vendor_id = :vendorId', { vendorId })
            .andWhere('product.number = :number', { number })
            .andWhere(productId ? 'product.id != :productId' : '1 = 1', { productId })
            .getOne();
        if (taken) {
            throw new BadRequestException(`Number ${number} is already used by ${taken.name} in ${taken.clientstore?.store_name}`);
        }
        return number;
    }

    private async validateProduct(shopId: number, vendorId: number, body: ElectricProductDto, productId?: number) {
        const name = String(body.name || '').trim();
        if (!name) throw new BadRequestException('Product name is required');
        if (!(await this.categoryRepository.findOne({ where: { id: body.category_id, clientstore: { id: shopId } } }))) {
            throw new BadRequestException('Choose a category');
        }
        if (body.brand_id && !(await this.brandRepository.findOne({ where: { id: body.brand_id, clientstore: { id: shopId } } }))) {
            throw new BadRequestException('Choose a brand from this shop');
        }
        if (!body.variants?.length) throw new BadRequestException('Add at least one size / variant');
        await this.assertFreeNumber(vendorId, body.number, productId);
        return name;
    }

    private variantData(variant: any, keepStock = false) {
        const data: any = {
            name: String(variant.name).trim(),
            barcode: String(variant.barcode || '').trim() || null,
            sale_price: roundAmount(Number(variant.sale_price) || 0),
            reorder_level: roundQuantity(Number(variant.reorder_level) || 0),
            is_active: variant.is_active !== false,
        };
        data.cost_price = roundAmount(Number(variant.cost_price) || 0);
        if (!keepStock) {
            data.stock = roundQuantity(Number(variant.stock) || 0);
        }
        return data;
    }

    private async openingEntry(manager: any, actor: AuthActor, product: any, variant: ElectricProductVariant, note: string) {
        if (!variant.stock) {
            return;
        }
        await manager.save(ElectricStockEntry, {
            vendor: { id: actor.vendor_id },
            clientstore: { id: product.clientstore_id },
            product: { id: product.id },
            variant: { id: variant.id },
            type: ElectricStockEntryType.IN,
            quantity: variant.stock,
            cost_price: variant.cost_price,
            total_cost: roundAmount(variant.stock * variant.cost_price),
            stock_after: variant.stock,
            cost_after: variant.cost_price,
            note,
            created_by_client: { id: actor.id },
        });
    }

    async createProduct(actor: AuthActor, body: ElectricProductDto) {
        const shop = await this.access.shop(actor, body.clientstore_id);
        const name = await this.validateProduct(shop.id, actor.vendor_id, body);
        const id = await this.dataSource.transaction(async (manager) => {
            const product = await manager.save(ElectricProduct, {
                vendor: { id: actor.vendor_id },
                clientstore: { id: shop.id },
                category: { id: body.category_id },
                brand: body.brand_id ? { id: body.brand_id } : null,
                number: this.cleanNumber(body.number),
                name,
                image_url: body.image_url || '',
                is_active: body.is_active !== false,
            });
            const saved = await manager.save(ElectricProductVariant, body.variants.map((variant) => ({ ...this.variantData(variant), product: { id: product.id } })));
            for (const variant of saved) {
                await this.openingEntry(manager, actor, { id: product.id, clientstore_id: shop.id }, variant, 'Opening stock');
            }
            return product.id;
        });
        return this.product(actor, id);
    }

    async updateProduct(actor: AuthActor, id: number, body: ElectricProductDto) {
        const existing = await this.product(actor, id);
        const name = await this.validateProduct(existing.clientstore_id, actor.vendor_id, body, existing.id);
        const keepIds = body.variants.map((variant) => Number(variant.id)).filter(Boolean);
        const removed = existing.variants.filter((variant) => !keepIds.includes(variant.id));
        const used = await this.usedVariantIds(removed.map((variant) => variant.id));
        await this.dataSource.transaction(async (manager) => {
            await manager.update(ElectricProduct, existing.id, {
                category: { id: body.category_id },
                brand: body.brand_id ? { id: body.brand_id } : null,
                number: this.cleanNumber(body.number),
                name,
                image_url: body.image_url || existing.image_url || '',
                is_active: body.is_active !== false,
            });
            for (const variant of body.variants) {
                const current = existing.variants.find((row) => row.id === Number(variant.id));
                if (current) {
                    const data = this.variantData(variant, true);
                    if (roundAmount(data.cost_price) !== roundAmount(current.cost_price)) {
                        await manager.save(ElectricStockEntry, {
                            vendor: { id: actor.vendor_id },
                            clientstore: { id: existing.clientstore_id },
                            product: { id: existing.id },
                            variant: { id: current.id },
                            type: ElectricStockEntryType.CORRECTION,
                            quantity: 0,
                            cost_price: data.cost_price,
                            total_cost: 0,
                            stock_after: current.stock,
                            cost_after: data.cost_price,
                            note: `Cost changed from ${current.cost_price} to ${data.cost_price}`,
                            created_by_client: { id: actor.id },
                        });
                    }
                    await manager.update(ElectricProductVariant, current.id, data);
                } else {
                    const saved = await manager.save(ElectricProductVariant, { ...this.variantData(variant), product: { id: existing.id } });
                    await this.openingEntry(manager, actor, existing, saved, 'Opening stock');
                }
            }
            const drop = removed.filter((variant) => !used.has(variant.id)).map((variant) => variant.id);
            const hide = removed.filter((variant) => used.has(variant.id)).map((variant) => variant.id);
            if (drop.length) await manager.delete(ElectricProductVariant, { id: In(drop) });
            if (hide.length) await manager.update(ElectricProductVariant, { id: In(hide) }, { is_active: false });
        });
        return this.product(actor, existing.id);
    }

    async addStock(actor: AuthActor, id: number, body: ElectricStockDto) {
        const product = await this.product(actor, id);
        const variant = product.variants.find((row) => row.id === Number(body.variant_id));
        if (!variant) {
            throw new NotFoundException('Size not found on this product');
        }
        const quantity = roundQuantity(Number(body.quantity) || 0);
        if (quantity <= 0) {
            throw new BadRequestException('Enter how many pieces came in');
        }
        const costPrice = roundAmount(Number(body.cost_price) || 0);
        if (costPrice <= 0) {
            throw new BadRequestException('Enter the price you paid for this stock');
        }
        const held = Math.max(roundQuantity(variant.stock), 0);
        const stockAfter = roundQuantity(held + quantity);
        const costAfter = roundAmount((held * variant.cost_price + quantity * costPrice) / stockAfter);
        await this.dataSource.transaction(async (manager) => {
            await manager.save(ElectricStockEntry, {
                vendor: { id: actor.vendor_id },
                clientstore: { id: product.clientstore_id },
                product: { id: product.id },
                variant: { id: variant.id },
                type: ElectricStockEntryType.IN,
                quantity,
                cost_price: costPrice,
                total_cost: roundAmount(quantity * costPrice),
                stock_after: stockAfter,
                cost_after: costAfter,
                supplier: body.supplier?.trim() || null,
                note: body.note?.trim() || null,
                created_by_client: { id: actor.id },
            });
            await manager.update(ElectricProductVariant, variant.id, { stock: stockAfter, cost_price: costAfter });
        });
        return this.product(actor, product.id);
    }

    async history(actor: AuthActor, id: number, variantId: any) {
        const product = await this.product(actor, id);
        const variant = variantId ? product.variants.find((row) => row.id === Number(variantId)) : null;
        if (variantId && !variant) {
            throw new NotFoundException('Size not found on this product');
        }
        const ids = variant ? [variant.id] : product.variants.map((row) => row.id);
        if (!ids.length) {
            return { product, variant: null, rows: [], totals: null };
        }
        const [entries, sold] = await Promise.all([
            this.dataSource.query(
                `SELECT entry.id, entry.variant_id, entry.type, entry.quantity, entry.cost_price, entry.total_cost, entry.stock_after, entry.cost_after,
                        entry.supplier, entry.note, entry.created_at, client.full_name AS created_by_name, variant.name AS variant_name
                 FROM electric_stock_entries entry
                 LEFT JOIN clients client ON client.id = entry.created_by
                 LEFT JOIN electric_product_variants variant ON variant.id = entry.variant_id
                 WHERE entry.variant_id IN (?) ORDER BY entry.id DESC`,
                [ids],
            ),
            this.dataSource.query(
                `SELECT item.id, item.variant_id, item.quantity, item.returned_quantity, item.unit_price, item.total, item.cost_price,
                        item.variant_name, sale.id AS sale_id, sale.bill_number, sale.created_at, counter.name AS counter_name, client.full_name AS cashier_name
                 FROM electric_sale_items item
                 JOIN electric_sales sale ON sale.id = item.sale_id
                 LEFT JOIN electric_counters counter ON counter.id = sale.counter_id
                 LEFT JOIN clients client ON client.id = sale.cashier_id
                 WHERE item.variant_id IN (?) ORDER BY sale.id DESC`,
                [ids],
            ),
        ]);
        const inRows = entries.map((row: any) => ({
            kind: row.type === ElectricStockEntryType.CORRECTION ? 'Correction' : 'In',
            id: `in-${row.id}`,
            variant_id: Number(row.variant_id),
            variant_name: row.variant_name,
            created_at: row.created_at,
            quantity: roundQuantity(parseFloat(row.quantity)),
            price: roundAmount(parseFloat(row.cost_price)),
            amount: roundAmount(parseFloat(row.total_cost)),
            stock_after: roundQuantity(parseFloat(row.stock_after)),
            cost_after: roundAmount(parseFloat(row.cost_after)),
            supplier: row.supplier,
            note: row.note,
            by: row.created_by_name,
        }));
        const outRows = sold.map((row: any) => {
            const quantity = roundQuantity(parseFloat(row.quantity));
            const returned = roundQuantity(parseFloat(row.returned_quantity) || 0);
            const kept = roundQuantity(quantity - returned);
            const share = quantity ? kept / quantity : 0;
            const amount = roundAmount(parseFloat(row.total) * share);
            const cost = row.cost_price === null ? null : roundAmount(parseFloat(row.cost_price) * kept);
            return {
                kind: 'Out',
                id: `out-${row.id}`,
                variant_id: Number(row.variant_id),
                variant_name: row.variant_name,
                created_at: row.created_at,
                quantity,
                returned_quantity: returned,
                price: roundAmount(parseFloat(row.unit_price)),
                amount,
                cost,
                profit: cost === null ? null : roundAmount(amount - cost),
                sale_id: Number(row.sale_id),
                bill_number: row.bill_number,
                counter: row.counter_name,
                by: row.cashier_name,
            };
        });
        const rows = [...inRows, ...outRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const piecesIn = roundQuantity(inRows.reduce((sum: number, row: any) => sum + row.quantity, 0));
        const piecesOut = roundQuantity(outRows.reduce((sum: number, row: any) => sum + row.quantity - row.returned_quantity, 0));
        const spent = roundAmount(inRows.reduce((sum: number, row: any) => sum + row.amount, 0));
        const earned = roundAmount(outRows.reduce((sum: number, row: any) => sum + row.amount, 0));
        const costOfSold = roundAmount(outRows.reduce((sum: number, row: any) => sum + (row.cost || 0), 0));
        return {
            product,
            variant: variant ? { id: variant.id, name: variant.name, stock: variant.stock, cost_price: variant.cost_price, sale_price: variant.sale_price } : null,
            rows,
            totals: {
                pieces_in: piecesIn,
                pieces_sold: piecesOut,
                stock_left: roundQuantity((variant ? [variant] : product.variants).reduce((sum, row) => sum + row.stock, 0)),
                spent,
                earned,
                cost_of_sold: costOfSold,
                profit: roundAmount(earned - costOfSold),
                pending_costs: outRows.filter((row: any) => row.cost === null).length,
            },
        };
    }

    async deleteProduct(actor: AuthActor, id: number) {
        const product = await this.product(actor, id);
        const used = await this.usedVariantIds(product.variants.map((variant) => variant.id));
        if (used.size) {
            await this.productRepository.update(product.id, { is_active: false });
            return { deactivated: true, message: 'This product is on old bills, so it was made inactive instead of deleted.' };
        }
        await this.productRepository.delete(product.id);
        return { message: 'Product deleted' };
    }

    async posCatalog(actor: AuthActor, clientstoreId: any) {
        if (!(await this.access.can(actor, 'pos_sell')) && !(await this.access.can(actor, 'quotations_create'))) {
            await this.access.need(actor, 'pos_sell', 'You cannot sell');
        }
        const shop = await this.access.shop(actor, clientstoreId);
        const products = (await this.productRepository.createQueryBuilder('product')
            .innerJoinAndSelect('product.variants', 'variant', 'variant.is_active = 1')
            .leftJoinAndSelect('product.brand', 'brand')
            .leftJoinAndSelect('product.category', 'category')
            .where('product.clientstore_id = :shopId AND product.is_active = 1', { shopId: shop.id })
            .orderBy('product.name', 'ASC')
            .getMany()).map((product) => this.productView(product));
        const brands = (await this.brandRepository.find({ where: { clientstore: { id: shop.id }, is_active: true }, order: { name: 'ASC' } }))
            .filter((brand) => products.some((product) => product.brand_id === brand.id));
        const categories = (await this.categoryRepository.find({ where: { clientstore: { id: shop.id }, is_active: true }, order: { sort_order: 'ASC', name: 'ASC' } }))
            .map((category) => {
                const inside = products.filter((product) => product.category_id === category.id);
                return { ...category, product_count: inside.length, brand_ids: [...new Set(inside.map((product) => product.brand_id))] };
            })
            .filter((category) => category.product_count);
        return { brands, categories, products };
    }
}
