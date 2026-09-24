import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { ElectricApi } from 'src/common/electric-api.decorator';
import { ElectricListDto } from 'src/common/electric.dto';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ElectricProductService } from './electric-product.service';
import { ElectricProductDto, ElectricStockDto } from './models/electric-product.dto';

@ElectricApi()
@ActorTypes(ActorType.CLIENT)
@Controller('electric')
export class ElectricProductController {
    constructor(private productService: ElectricProductService) { }

    @HasPermission('products_view')
    @Post('products/v1/list')
    list(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.productService.listProducts(actor, body);
    }

    @HasPermission('products_view')
    @Post('products/v1/kpis')
    kpis(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.productService.productKpis(actor, body);
    }

    @HasPermission('products_view')
    @Get('products/:id')
    product(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.productService.product(actor, Number(id));
    }

    @HasPermission('products_create')
    @Post('products')
    create(@Actor() actor: AuthActor, @Body() body: ElectricProductDto) {
        return this.productService.createProduct(actor, body);
    }

    @HasPermission('products_edit')
    @Put('products/:id')
    update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ElectricProductDto) {
        return this.productService.updateProduct(actor, Number(id), body);
    }

    @HasPermission('products_stock')
    @Post('products/:id/stock')
    addStock(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ElectricStockDto) {
        return this.productService.addStock(actor, Number(id), body);
    }

    @HasPermission('products_view')
    @Get('products/:id/history')
    history(@Actor() actor: AuthActor, @Param('id') id: number, @Query('variant_id') variantId: number) {
        return this.productService.history(actor, Number(id), variantId);
    }

    @HasPermission('products_delete')
    @Delete('products/:id')
    remove(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.productService.deleteProduct(actor, Number(id));
    }

    @HasPermission('pos_sell', 'quotations_create')
    @Get('pos/catalog')
    catalog(@Actor() actor: AuthActor, @Query('clientstore_id') clientstoreId: number) {
        return this.productService.posCatalog(actor, clientstoreId);
    }
}
