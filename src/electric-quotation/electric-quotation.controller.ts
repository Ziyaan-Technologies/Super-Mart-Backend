import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { ElectricApi } from 'src/common/electric-api.decorator';
import { ElectricListDto } from 'src/common/electric.dto';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ElectricQuotationService } from './electric-quotation.service';

@ElectricApi()
@ActorTypes(ActorType.CLIENT)
@Controller('electric/quotations')
export class ElectricQuotationController {
    constructor(private quotationService: ElectricQuotationService) { }

    @HasPermission('quotations_create')
    @Post()
    create(@Actor() actor: AuthActor, @Body() body: any) {
        return this.quotationService.createQuotation(actor, body);
    }

    @HasPermission('quotations_view')
    @Post('v1/list')
    list(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.quotationService.listQuotations(actor, body);
    }

    @HasPermission('quotations_view')
    @Get(':id')
    quotation(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.quotationService.quotation(actor, Number(id));
    }
}
