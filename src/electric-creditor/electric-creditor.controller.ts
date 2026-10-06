import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { ElectricApi } from 'src/common/electric-api.decorator';
import { ElectricListDto } from 'src/common/electric.dto';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ElectricCreditorService } from './electric-creditor.service';
import { ElectricCreditorDto, ElectricCreditorEntryDto, ElectricCreditorIncentiveDto, ElectricCreditorPaymentDto, ElectricCreditorUpdateDto } from './models/electric-creditor.dto';

@ElectricApi()
@ActorTypes(ActorType.CLIENT)
@Controller('electric/creditors')
export class ElectricCreditorController {
    constructor(private creditorService: ElectricCreditorService) { }

    @HasPermission('creditors_view')
    @Post('v1/list')
    list(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.creditorService.list(actor, body);
    }

    @HasPermission('creditors_view')
    @Post('v1/kpis')
    kpis(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.creditorService.kpis(actor, body.clientstore_id);
    }

    @HasPermission('pos_outside_item', 'creditors_view')
    @Get('list')
    dropdown(@Actor() actor: AuthActor, @Query('clientstore_id') clientstoreId: number, @Query('search') search: string) {
        return this.creditorService.dropdown(actor, clientstoreId, search);
    }

    @HasPermission('creditors_view')
    @Get(':id')
    detail(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.creditorService.detail(actor, id);
    }

    @HasPermission('creditors_create')
    @Post()
    create(@Actor() actor: AuthActor, @Body() body: ElectricCreditorDto) {
        return this.creditorService.create(actor, body);
    }

    @HasPermission('creditors_edit')
    @Put(':id')
    update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ElectricCreditorUpdateDto) {
        return this.creditorService.update(actor, id, body);
    }

    @HasPermission('creditors_delete')
    @Delete(':id')
    remove(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.creditorService.remove(actor, id);
    }

    @HasPermission('creditors_edit')
    @Post(':id/entries')
    addEntry(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ElectricCreditorEntryDto) {
        return this.creditorService.addEntry(actor, id, body);
    }

    @HasPermission('creditors_edit')
    @Post(':id/incentives')
    addIncentive(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ElectricCreditorIncentiveDto) {
        return this.creditorService.addIncentive(actor, id, body);
    }

    @HasPermission('creditors_payment')
    @Post(':id/payments')
    addPayment(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ElectricCreditorPaymentDto) {
        return this.creditorService.addPayment(actor, id, body);
    }

    @HasPermission('creditors_payment')
    @Put(':id/payments/:paymentId')
    updatePayment(@Actor() actor: AuthActor, @Param('id') id: number, @Param('paymentId') paymentId: number, @Body() body: ElectricCreditorPaymentDto) {
        return this.creditorService.updatePayment(actor, id, paymentId, body);
    }

    @HasPermission('creditors_payment')
    @Delete(':id/payments/:paymentId')
    removePayment(@Actor() actor: AuthActor, @Param('id') id: number, @Param('paymentId') paymentId: number) {
        return this.creditorService.removePayment(actor, id, paymentId);
    }
}
