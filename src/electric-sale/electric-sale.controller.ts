import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { ElectricApi } from 'src/common/electric-api.decorator';
import { ElectricListDto } from 'src/common/electric.dto';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ElectricSaleService } from './electric-sale.service';

@ElectricApi()
@ActorTypes(ActorType.CLIENT)
@Controller('electric')
export class ElectricSaleController {
    constructor(private saleService: ElectricSaleService) { }

    @HasPermission('pos_sell')
    @Post('sales')
    create(@Actor() actor: AuthActor, @Body() body: any) {
        return this.saleService.createSale(actor, body);
    }

    @HasPermission('sales_view')
    @Post('sales/v1/list')
    list(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.saleService.listSales(actor, body);
    }

    @HasPermission('sales_view')
    @Post('sales/v1/kpis')
    kpis(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.saleService.salesKpis(actor, body);
    }

    @HasPermission('sales_view')
    @Get('sales/:id')
    sale(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.saleService.sale(actor, Number(id));
    }

    @HasPermission('sales_payment')
    @Post('sales/:id/payments')
    payBill(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: any) {
        return this.saleService.payBill(actor, Number(id), body);
    }

    @HasPermission('debtors_create')
    @Get('sales/:id/debtor-match')
    matchDebtor(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.saleService.matchDebtor(actor, Number(id));
    }

    @HasPermission('debtors_create')
    @Post('sales/:id/debtor')
    attachDebtor(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: any) {
        return this.saleService.attachDebtor(actor, Number(id), body);
    }

    @HasPermission('pos_return')
    @Post('sales/:id/return')
    returnSale(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: any) {
        return this.saleService.returnSale(actor, Number(id), body);
    }

    @HasPermission('pending_costs_view')
    @Post('pending-costs/v1/list')
    pending(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.saleService.listPending(actor, body);
    }

    @Get('pending-costs/count')
    pendingCount(@Actor() actor: AuthActor, @Query('clientstore_id') clientstoreId: number) {
        return this.saleService.pendingCount(actor, clientstoreId);
    }

    @HasPermission('pending_costs_edit')
    @Put('sale-items/:id/cost')
    enterCost(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: { cost_price: number; creditor_id?: number }) {
        return this.saleService.enterCost(actor, Number(id), body.cost_price, body.creditor_id);
    }
}
