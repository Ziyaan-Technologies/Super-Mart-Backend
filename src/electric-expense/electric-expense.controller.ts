import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { ElectricApi } from 'src/common/electric-api.decorator';
import { ElectricListDto } from 'src/common/electric.dto';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ElectricExpenseService } from './electric-expense.service';

@ElectricApi()
@ActorTypes(ActorType.CLIENT)
@Controller('electric/expenses')
export class ElectricExpenseController {
    constructor(private expenseService: ElectricExpenseService) { }

    @HasPermission('expenses_view')
    @Post('v1/list')
    list(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.expenseService.listDays(actor, body);
    }

    @HasPermission('expenses_view')
    @Post('v1/kpis')
    kpis(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.expenseService.kpis(actor, body);
    }

    @HasPermission('expenses_view')
    @Get('day')
    day(@Actor() actor: AuthActor, @Query('clientstore_id') clientstoreId: number, @Query('date') date: string) {
        return this.expenseService.day(actor, clientstoreId, date);
    }
}
