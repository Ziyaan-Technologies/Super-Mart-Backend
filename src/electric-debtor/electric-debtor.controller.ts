import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { ElectricApi } from 'src/common/electric-api.decorator';
import { ElectricListDto } from 'src/common/electric.dto';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ElectricDebtorService } from './electric-debtor.service';
import { ElectricDebtorDto, ElectricDebtorPaymentDto, ElectricDebtorUpdateDto } from './models/electric-debtor.dto';

@ElectricApi()
@ActorTypes(ActorType.CLIENT)
@Controller('electric/debtors')
export class ElectricDebtorController {
    constructor(private debtorService: ElectricDebtorService) { }

    @HasPermission('debtors_view')
    @Post('v1/list')
    list(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.debtorService.list(actor, body);
    }

    @HasPermission('debtors_view')
    @Post('v1/kpis')
    kpis(@Actor() actor: AuthActor) {
        return this.debtorService.kpis(actor);
    }

    @HasPermission('pos_debtor_sale', 'debtors_view')
    @Get('list')
    dropdown(@Actor() actor: AuthActor, @Query('search') search: string) {
        return this.debtorService.dropdown(actor, search);
    }

    @HasPermission('debtors_view')
    @Get(':id')
    detail(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.debtorService.detail(actor, id);
    }

    @HasPermission('debtors_create')
    @Post()
    create(@Actor() actor: AuthActor, @Body() body: ElectricDebtorDto) {
        return this.debtorService.create(actor, body);
    }

    @HasPermission('debtors_edit')
    @Put(':id')
    update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ElectricDebtorUpdateDto) {
        return this.debtorService.update(actor, id, body);
    }

    @HasPermission('debtors_delete')
    @Delete(':id')
    remove(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.debtorService.remove(actor, id);
    }

    @HasPermission('debtors_payment')
    @Post(':id/payments')
    addPayment(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ElectricDebtorPaymentDto) {
        return this.debtorService.addPayment(actor, id, body);
    }
}
