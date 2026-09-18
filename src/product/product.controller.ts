import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { dateRangeCondition, growth, previousDateRangeCondition } from 'src/common/list-query';
import { requiredVendorId, scopedClientstoreId, scopedVendorId } from 'src/common/tenant-scope';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ClientstoreService } from 'src/clientstore/clientstore.service';
import { ProductService } from './product.service';
import { ProductCreateDto, ProductListDto, ProductUpdateDto } from './models/product.dto';

@ActorTypes(ActorType.ADMIN, ActorType.CLIENT)
@Controller('products')
export class ProductController {
    constructor(
        private productService: ProductService,
        private clientstoreService: ClientstoreService,
        private exportService: ExportService
    ) { }

    private async storeFilter(actor: AuthActor, clientstoreId?: number) {
        const scopedId = scopedClientstoreId(actor, clientstoreId);
        if (scopedId) {
            await this.clientstoreService.accessible(actor, scopedId);
        }
        return scopedId || null;
    }

    @HasPermission('products_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor, @Body() body: ProductListDto) {
        const vendorId = scopedVendorId(actor, body.vendor_id);
        const base: any = vendorId ? { vendor: { id: vendorId } } : {};
        const current = { ...base, ...dateRangeCondition(body.startDate, body.endDate) };
        const previous = { ...base, ...previousDateRangeCondition(body.startDate, body.endDate) };
        const totalProducts = await this.productService.count(current);
        const activeProducts = await this.productService.count({ ...current, is_active: true });
        const inactiveProducts = await this.productService.count({ ...current, is_active: false });
        const expiryTracked = await this.productService.count({ ...current, track_expiry: true });
        const previousTotal = body.startDate && body.endDate ? await this.productService.count(previous) : 0;
        return {
            totalProducts,
            totalProductsGrowth: growth(totalProducts, previousTotal, body.startDate, body.endDate),
            activeProducts,
            inactiveProducts,
            expiryTracked,
        };
    }

    @HasPermission('products_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: ProductListDto) {
        return this.productService.search(scopedVendorId(actor, body.vendor_id), body);
    }

    @HasPermission('products_view', 'purchase_orders_create', 'purchase_orders_edit', 'goods_receipts_create', 'goods_receipts_edit', 'stock_transfers_create', 'stock_transfers_edit', 'stock_adjustments_create', 'stock_adjustments_edit', 'stock_view', 'stock_opening')
    @Get('variants/search')
    async searchVariants(
        @Actor() actor: AuthActor,
        @Query('q') term = '',
        @Query('clientstore_id') clientstoreId?: number,
        @Query('vendor_id') vendorId?: number,
        @Query('limit') limit = 20,
    ) {
        const storeId = await this.storeFilter(actor, clientstoreId);
        return this.productService.searchVariants(requiredVendorId(actor, vendorId), term.trim(), storeId, Math.min(Number(limit) || 20, 50));
    }

    @HasPermission('products_view', 'purchase_orders_create', 'goods_receipts_create', 'stock_transfers_create', 'stock_adjustments_create', 'stock_view', 'stock_opening')
    @Get('variants/barcode/:code')
    async byBarcode(
        @Actor() actor: AuthActor,
        @Param('code') code: string,
        @Query('clientstore_id') clientstoreId?: number,
        @Query('vendor_id') vendorId?: number,
    ) {
        const storeId = await this.storeFilter(actor, clientstoreId);
        const [variant] = await this.productService.searchVariants(requiredVendorId(actor, vendorId), code.trim(), storeId, 1, true);
        if (!variant) {
            throw new NotFoundException('No product found for this barcode');
        }
        return variant;
    }

    @HasPermission('products_create')
    @Post()
    async create(@Actor() actor: AuthActor, @Body() body: ProductCreateDto) {
        const vendorId = requiredVendorId(actor, body.vendor_id);
        const product = await this.productService.createWithVariants(vendorId, body);
        return this.get(actor, product.id);
    }

    @HasPermission('products_view')
    @Get(':id')
    async get(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.productService.accessible(actor, id, ['vendor', 'category', 'brand', 'unit', 'tax', 'variants']);
    }

    @HasPermission('products_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ProductUpdateDto) {
        const product = await this.productService.accessible(actor, id);
        await this.productService.updateWithVariants(product, body);
        return this.get(actor, product.id);
    }

    @HasPermission('products_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        const product = await this.productService.accessible(actor, id);
        return this.productService.deleteProduct(product);
    }

    @HasPermission('products_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: ProductListDto, @Res() res: Response) {
        const response = await this.productService.search(scopedVendorId(actor, body.vendor_id), { ...body, page: 1, take: 100000 });
        const rows = response.data.flatMap((product: any) => product.variants.map((variant: any) => ({ ...variant, product })));
        const columns = [
            { header: 'Product', key: 'product', width: 28, value: (row: any) => row.product.name },
            { header: 'Variant', key: 'name', width: 20 },
            { header: 'SKU', key: 'sku', width: 16 },
            { header: 'Barcode', key: 'barcode', width: 18 },
            { header: 'Category', key: 'category', width: 20, value: (row: any) => row.product.category?.name },
            { header: 'Brand', key: 'brand', width: 18, value: (row: any) => row.product.brand?.name },
            { header: 'Unit', key: 'unit', width: 10, value: (row: any) => row.product.unit?.short_name },
            { header: 'Cost', key: 'cost_price', width: 12 },
            { header: 'Price', key: 'sale_price', width: 12 },
            { header: 'Reorder', key: 'reorder_level', width: 10 },
            { header: 'Status', key: 'is_active', width: 12 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Products', columns, rows);
        }
        return this.exportService.excel(res, 'Products', columns, rows);
    }
}
