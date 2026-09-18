import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { VendorScopedService } from 'src/common/vendor-scoped.service';
import { dateRangeCondition } from 'src/common/list-query';
import { CategoryService } from 'src/category/category.service';
import { BrandService } from 'src/brand/brand.service';
import { TaxService } from 'src/tax/tax.service';
import { UnitService } from 'src/unit/unit.service';
import { Product } from './models/product.entity';
import { ProductVariant } from './models/product-variant.entity';
import { ProductCreateDto, ProductListDto, ProductUpdateDto, ProductVariantDto } from './models/product.dto';

@Injectable()
export class ProductService extends VendorScopedService {
    protected readonly label = 'Product';

    constructor(
        @InjectRepository(Product, 'MainConnection') private readonly productRepository: Repository<Product>,
        @InjectRepository(ProductVariant, 'MainConnection') private readonly variantRepository: Repository<ProductVariant>,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
        private categoryService: CategoryService,
        private brandService: BrandService,
        private taxService: TaxService,
        private unitService: UnitService,
    ) {
        super(productRepository);
    }

    async validateReferences(vendorId: number, body: Partial<ProductCreateDto>) {
        if (body.category_id !== undefined) {
            await this.categoryService.assertOwnedByVendor(body.category_id, vendorId);
        }
        if (body.brand_id) {
            await this.brandService.assertOwnedByVendor(body.brand_id, vendorId);
        }
        if (body.tax_id) {
            await this.taxService.assertOwnedByVendor(body.tax_id, vendorId);
        }
        if (body.unit_id !== undefined) {
            const unit = await this.unitService.findOne({ id: body.unit_id, is_active: true });
            if (!unit) {
                throw new BadRequestException('The selected unit is not valid');
            }
        }
    }

    private normalizeVariants(variants: ProductVariantDto[]) {
        return variants.map((variant) => ({
            ...variant,
            sku: variant.sku.trim(),
            barcode: variant.barcode?.trim() || null,
        }));
    }

    async assertVariantCodes(vendorId: number, variants: ProductVariantDto[], productId?: number) {
        const skus = variants.map((variant) => variant.sku.toLowerCase());
        const barcodes = variants.filter((variant) => variant.barcode).map((variant) => variant.barcode.toLowerCase());
        const duplicateSku = skus.find((sku, index) => skus.indexOf(sku) !== index);
        if (duplicateSku) {
            throw new BadRequestException(`SKU "${duplicateSku}" is repeated`);
        }
        const duplicateBarcode = barcodes.find((barcode, index) => barcodes.indexOf(barcode) !== index);
        if (duplicateBarcode) {
            throw new BadRequestException(`Barcode "${duplicateBarcode}" is repeated`);
        }
        const conditions: any[] = [
            ...variants.map((variant) => ({ vendor: { id: vendorId }, sku: variant.sku })),
            ...variants.filter((variant) => variant.barcode).map((variant) => ({ vendor: { id: vendorId }, barcode: variant.barcode })),
        ];
        const existing = await this.variantRepository.find({ where: conditions, withDeleted: true });
        const conflict = existing.find((row) => !(productId && row.product_id === Number(productId) && variants.some((variant) => variant.id === row.id)));
        if (conflict) {
            const field = variants.some((variant) => variant.sku.toLowerCase() === conflict.sku.toLowerCase()) ? `SKU "${conflict.sku}"` : `Barcode "${conflict.barcode}"`;
            throw new BadRequestException(`${field} is already used by another product`);
        }
    }

    private productFields(body: Partial<ProductCreateDto>) {
        const { vendor_id, category_id, brand_id, unit_id, tax_id, variants, ...rest } = body as any;
        return {
            ...rest,
            ...(category_id !== undefined ? { category: { id: category_id } } : {}),
            ...(brand_id !== undefined ? { brand: brand_id ? { id: brand_id } : null } : {}),
            ...(unit_id !== undefined ? { unit: { id: unit_id } } : {}),
            ...(tax_id !== undefined ? { tax: tax_id ? { id: tax_id } : null } : {}),
        };
    }

    private variantFields(variant: ProductVariantDto) {
        const { id, ...rest } = variant;
        return rest;
    }

    async createWithVariants(vendorId: number, body: ProductCreateDto): Promise<Product> {
        const variants = this.normalizeVariants(body.variants);
        await this.validateReferences(vendorId, body);
        await this.assertVariantCodes(vendorId, variants);
        return this.dataSource.transaction(async (manager) => {
            const product = await manager.save(Product, {
                ...this.productFields(body),
                vendor: { id: vendorId },
            });
            await manager.save(ProductVariant, variants.map((variant) => ({
                ...this.variantFields(variant),
                product: { id: product.id },
                vendor: { id: vendorId },
            })));
            return product;
        });
    }

    async updateWithVariants(product: Product, body: ProductUpdateDto) {
        await this.validateReferences(product.vendor_id, body);
        const variants = body.variants ? this.normalizeVariants(body.variants) : null;
        if (variants) {
            await this.assertVariantCodes(product.vendor_id, variants, product.id);
        }
        await this.dataSource.transaction(async (manager) => {
            const fields = this.productFields(body);
            if (Object.keys(fields).length) {
                await manager.update(Product, product.id, fields);
            }
            if (!variants) {
                return;
            }
            const existing = await manager.find(ProductVariant, { where: { product: { id: product.id } } });
            const existingIds = existing.map((variant) => variant.id);
            for (const variant of variants) {
                if (variant.id) {
                    if (!existingIds.includes(variant.id)) {
                        throw new BadRequestException(`Variant ${variant.id} does not belong to this product`);
                    }
                    await manager.update(ProductVariant, variant.id, this.variantFields(variant));
                } else {
                    await manager.save(ProductVariant, {
                        ...this.variantFields(variant),
                        product: { id: product.id },
                        vendor: { id: product.vendor_id },
                    });
                }
            }
            const removed = existing.filter((variant) => !variants.some((item) => item.id === variant.id));
            if (!removed.length) {
                return;
            }
            const used = await this.variantsWithHistory(removed.map((variant) => variant.id));
            for (const variant of removed) {
                if (used.has(variant.id)) {
                    await manager.update(ProductVariant, variant.id, { is_active: false });
                } else {
                    await manager.softDelete(ProductVariant, variant.id);
                }
            }
        });
    }

    async variantsWithHistory(variantIds: number[]): Promise<Set<number>> {
        if (!variantIds.length) {
            return new Set();
        }
        const rows = await this.dataSource.query(
            'SELECT DISTINCT product_variant_id AS id FROM stock_movements WHERE product_variant_id IN (?) UNION SELECT DISTINCT product_variant_id AS id FROM purchase_order_items WHERE product_variant_id IN (?)',
            [variantIds, variantIds],
        );
        return new Set(rows.map((row) => Number(row.id)));
    }

    async deleteProduct(product: Product) {
        const variants = await this.variantRepository.find({ where: { product: { id: product.id } } });
        const used = await this.variantsWithHistory(variants.map((variant) => variant.id));
        const variantIds = variants.map((variant) => variant.id);
        if (used.size) {
            await this.productRepository.update(product.id, { is_active: false });
            if (variantIds.length) {
                await this.variantRepository.update({ id: In(variantIds) }, { is_active: false });
            }
            return { message: 'This product has stock history, so it was deactivated instead of deleted', deactivated: true };
        }
        await this.dataSource.transaction(async (manager) => {
            if (variantIds.length) {
                await manager.softDelete(ProductVariant, variantIds);
            }
            await manager.softDelete(Product, product.id);
        });
        return { message: 'Success', deactivated: false };
    }

    private filteredQuery(vendorId: number | undefined, body: ProductListDto, categoryIds: number[] | null) {
        const query = this.productRepository
            .createQueryBuilder('product')
            .leftJoin('product.variants', 'variant');
        if (vendorId) {
            query.andWhere('product.vendor_id = :vendorId', { vendorId });
        }
        if (categoryIds) {
            query.andWhere('product.category_id IN (:...categoryIds)', { categoryIds });
        }
        if (body.brand_id) {
            query.andWhere('product.brand_id = :brandId', { brandId: body.brand_id });
        }
        if (body.status && body.status !== 'All Statuses') {
            query.andWhere('product.is_active = :active', { active: body.status.toLowerCase() === 'active' });
        }
        const dateCondition: any = dateRangeCondition(body.startDate, body.endDate);
        if (dateCondition.created_at) {
            query.andWhere('product.created_at BETWEEN :startDate AND :endDate', {
                startDate: dateCondition.created_at.value[0],
                endDate: dateCondition.created_at.value[1],
            });
        }
        if (body.search) {
            query.andWhere(new Brackets((inner) => {
                inner.where('product.name LIKE :search', { search: `%${body.search}%` })
                    .orWhere('variant.sku LIKE :search')
                    .orWhere('variant.barcode LIKE :search')
                    .orWhere('variant.name LIKE :search');
            }));
        }
        return query;
    }

    async search(vendorId: number | undefined, body: ProductListDto) {
        const page = body.page || 1;
        const take = body.take || 10;
        let categoryIds: number[] | null = null;
        if (body.category_id) {
            categoryIds = body.include_subcategories === false ? [Number(body.category_id)] : await this.categoryService.descendantIds(body.category_id);
        }
        const total = Number((await this.filteredQuery(vendorId, body, categoryIds).select('COUNT(DISTINCT product.id)', 'total').getRawOne()).total);
        const idRows = await this.filteredQuery(vendorId, body, categoryIds)
            .select('product.id', 'id')
            .groupBy('product.id')
            .orderBy('product.id', body.sortBy === 'Oldest' ? 'ASC' : 'DESC')
            .offset((page - 1) * take)
            .limit(take)
            .getRawMany();
        const ids = idRows.map((row) => Number(row.id));
        const products = ids.length
            ? await this.productRepository.find({
                where: { id: In(ids) },
                relations: ['vendor', 'category', 'brand', 'unit', 'tax', 'variants'],
            })
            : [];
        const ordered = ids.map((id) => products.find((product) => product.id === id)).filter(Boolean);
        return {
            data: ordered,
            meta: {
                total,
                page: Math.ceil(page),
                last_page: Math.ceil(total / take),
            },
        };
    }

    async searchVariants(vendorId: number, term: string, clientstoreId: number | null, limit: number, exactBarcode = false, options: { categoryIds?: number[] | null; offset?: number } = {}) {
        const query = this.variantRepository
            .createQueryBuilder('variant')
            .innerJoin('variant.product', 'product')
            .leftJoin('product.unit', 'unit')
            .leftJoin('product.tax', 'tax')
            .select([
                'variant.id AS id',
                'variant.name AS name',
                'variant.sku AS sku',
                'variant.barcode AS barcode',
                'variant.unit_quantity AS unit_quantity',
                'variant.cost_price AS cost_price',
                'variant.sale_price AS sale_price',
                'variant.mrp AS mrp',
                'variant.reorder_level AS reorder_level',
                'product.id AS product_id',
                'product.name AS product_name',
                'product.image_url AS image_url',
                'product.category_id AS category_id',
                'product.is_weighted AS is_weighted',
                'product.track_expiry AS track_expiry',
                'product.price_includes_tax AS price_includes_tax',
                'unit.short_name AS unit_short_name',
                'unit.allow_decimal AS allow_decimal',
                'tax.rate AS tax_rate',
            ])
            .where('variant.vendor_id = :vendorId', { vendorId })
            .andWhere('variant.is_active = 1')
            .andWhere('product.is_active = 1');
        if (clientstoreId) {
            query
                .leftJoin('stocks', 'stock', 'stock.product_variant_id = variant.id AND stock.clientstore_id = :clientstoreId', { clientstoreId })
                .addSelect('COALESCE(stock.quantity, 0)', 'stock_quantity')
                .addSelect('COALESCE(stock.average_cost, variant.cost_price)', 'average_cost');
        }
        if (options.categoryIds?.length) {
            query.andWhere('product.category_id IN (:...categoryIds)', { categoryIds: options.categoryIds });
        }
        if (exactBarcode) {
            query.andWhere(new Brackets((inner) => {
                inner.where('variant.barcode = :term', { term }).orWhere('variant.sku = :term');
            }));
        } else if (term) {
            query.andWhere(new Brackets((inner) => {
                inner.where('product.name LIKE :like', { like: `%${term}%` })
                    .orWhere('variant.name LIKE :like')
                    .orWhere('variant.sku LIKE :like')
                    .orWhere('variant.barcode LIKE :like');
            }));
        }
        const rows = await query.orderBy('product.name', 'ASC').addOrderBy('variant.name', 'ASC').offset(options.offset || 0).limit(limit).getRawMany();
        const numeric = ['unit_quantity', 'cost_price', 'sale_price', 'mrp', 'reorder_level', 'tax_rate', 'stock_quantity', 'average_cost'];
        const flags = ['is_weighted', 'track_expiry', 'price_includes_tax', 'allow_decimal'];
        return rows.map((row) => {
            numeric.forEach((key) => {
                if (row[key] !== undefined && row[key] !== null) row[key] = parseFloat(row[key]);
            });
            flags.forEach((key) => {
                if (row[key] !== undefined && row[key] !== null) row[key] = Boolean(Number(row[key]));
            });
            row.stock_unit = row.is_weighted ? row.unit_short_name : 'pcs';
            return row;
        });
    }

    async variantsForVendor(vendorId: number, variantIds: number[]) {
        const unique = Array.from(new Set(variantIds.map(Number)));
        const variants = await this.variantRepository.find({
            where: { id: In(unique), vendor: { id: vendorId } },
            relations: ['product', 'product.unit', 'product.tax'],
        });
        if (variants.length !== unique.length) {
            throw new BadRequestException('One or more selected products are not valid');
        }
        return new Map(variants.map((variant) => [variant.id, variant]));
    }

    async updateCostPrice(variantId: number, cost: number) {
        await this.variantRepository.update(variantId, { cost_price: cost });
    }
}
