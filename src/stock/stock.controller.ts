import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { requiredVendorId, scopedClientstoreId, scopedVendorId } from 'src/common/tenant-scope';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ClientstoreService } from 'src/clientstore/clientstore.service';
import { CategoryService } from 'src/category/category.service';
import { ProductService } from 'src/product/product.service';
import { StockService } from './stock.service';
import { StockMovementType } from './models/stock-movement.entity';
import { OpeningStockDto, StockExpiryListDto, StockListDto, StockMovementListDto } from './models/stock.dto';

@ActorTypes(ActorType.ADMIN, ActorType.CLIENT)
@Controller('stock')
export class StockController {
    constructor(
        private stockService: StockService,
        private clientstoreService: ClientstoreService,
        private categoryService: CategoryService,
        private productService: ProductService,
        private exportService: ExportService
    ) { }

    private async storeScope(actor: AuthActor, clientstoreId?: number) {
        const scopedId = scopedClientstoreId(actor, clientstoreId);
        if (scopedId) {
            await this.clientstoreService.accessible(actor, scopedId);
        }
        return scopedId || null;
    }

    private async listFilter(actor: AuthActor, body: StockListDto) {
        return {
            vendorId: scopedVendorId(actor, body.vendor_id),
            clientstoreId: await this.storeScope(actor, body.clientstore_id),
            search: body.search,
            categoryIds: body.category_id ? await this.categoryService.descendantIds(body.category_id) : null,
            brandId: body.brand_id,
            stockStatus: body.stock_status,
        };
    }

    @HasPermission('stock_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor, @Body() body: StockListDto) {
        return this.stockService.stockKpis(await this.listFilter(actor, body));
    }

    @HasPermission('stock_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: StockListDto) {
        return this.stockService.stockList(await this.listFilter(actor, body), body.page || 1, body.take || 10, body.sortBy);
    }

    @HasPermission('stock_view')
    @Post('v1/movements')
    async movements(@Actor() actor: AuthActor, @Body() body: StockMovementListDto) {
        return this.stockService.movements({
            vendorId: scopedVendorId(actor, body.vendor_id),
            clientstoreId: await this.storeScope(actor, body.clientstore_id),
            variantId: body.product_variant_id,
            type: body.type,
            search: body.search,
            startDate: body.startDate,
            endDate: body.endDate,
        }, body.page || 1, body.take || 10);
    }

    @Get('movement-types')
    async movementTypes() {
        return Object.values(StockMovementType);
    }

    @HasPermission('stock_view')
    @Post('v1/expiry')
    async expiry(@Actor() actor: AuthActor, @Body() body: StockExpiryListDto) {
        return this.stockService.expiringBatches({
            vendorId: scopedVendorId(actor, body.vendor_id),
            clientstoreId: await this.storeScope(actor, body.clientstore_id),
            days: Math.max(0, Number(body.days ?? 30)),
            search: body.search,
            includeExpired: body.include_expired !== false,
        }, body.page || 1, body.take || 10);
    }

    @HasPermission('stock_view', 'products_view')
    @Get('variant/:variantId')
    async variantStock(@Actor() actor: AuthActor, @Param('variantId') variantId: number, @Query('clientstore_id') clientstoreId?: number) {
        return this.stockService.variantStock(scopedVendorId(actor), variantId, await this.storeScope(actor, clientstoreId));
    }

    @HasPermission('stock_view', 'stock_adjustments_create', 'stock_adjustments_edit')
    @Get('batches')
    async batches(@Actor() actor: AuthActor, @Query('clientstore_id') clientstoreId: number, @Query('product_variant_id') variantId: number) {
        const storeId = await this.storeScope(actor, clientstoreId);
        if (!storeId || !variantId) {
            throw new BadRequestException('clientstore_id and product_variant_id are required');
        }
        return this.stockService.availableBatches(storeId, variantId);
    }

    @ActorTypes(ActorType.CLIENT)
    @HasPermission('stock_opening')
    @Post('opening')
    async opening(@Actor() actor: AuthActor, @Body() body: OpeningStockDto) {
        const vendorId = requiredVendorId(actor);
        const clientstoreId = await this.storeScope(actor, body.clientstore_id);
        const variants = await this.productService.variantsForVendor(vendorId, body.items.map((item) => item.product_variant_id));
        await this.stockService.transaction(async (manager) => {
            for (const item of body.items) {
                const variant = variants.get(item.product_variant_id);
                if (variant.product.track_expiry && !item.expiry_date) {
                    throw new BadRequestException(`Expiry date is required for ${variant.product.name}`);
                }
                await this.stockService.applyMovement(manager, {
                    vendorId,
                    clientstoreId,
                    variantId: variant.id,
                    type: StockMovementType.OPENING,
                    quantity: item.quantity,
                    unitCost: item.unit_cost,
                    batches: item.batch_number || item.expiry_date
                        ? [{ batch_number: item.batch_number || null, expiry_date: item.expiry_date || null, quantity: item.quantity, unit_cost: item.unit_cost }]
                        : [],
                    trackExpiry: variant.product.track_expiry,
                    allowNegative: true,
                    reference: { type: 'opening', id: null, number: 'OPENING' },
                    note: body.note,
                    createdById: actor.id,
                });
            }
        });
        return { message: 'Success' };
    }

    @HasPermission('stock_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: StockListDto, @Res() res: Response) {
        const response = await this.stockService.stockList(await this.listFilter(actor, body), 1, 100000, body.sortBy);
        const columns = [
            { header: 'Product', key: 'product_name', width: 28 },
            { header: 'Variant', key: 'variant_name', width: 18 },
            { header: 'SKU', key: 'sku', width: 16 },
            { header: 'Category', key: 'category_name', width: 20 },
            { header: 'Quantity', key: 'quantity', width: 12 },
            { header: 'Unit', key: 'stock_unit', width: 8 },
            { header: 'Reorder', key: 'reorder_level', width: 10 },
            { header: 'Avg Cost', key: 'average_cost', width: 12 },
            { header: 'Value', key: 'stock_value', width: 14 },
            { header: 'Status', key: 'stock_status', width: 14 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Stock', columns, response.data);
        }
        return this.exportService.excel(res, 'Stock', columns, response.data);
    }
}
