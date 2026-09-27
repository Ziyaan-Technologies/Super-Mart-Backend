import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { ElectricApi } from 'src/common/electric-api.decorator';
import { ElectricListDto } from 'src/common/electric.dto';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ElectricSaleService } from 'src/electric-sale/electric-sale.service';
import { ElectricCounterService } from './electric-counter.service';
import { ElectricCounterDto } from './models/electric-counter.dto';

@ElectricApi()
@ActorTypes(ActorType.CLIENT)
@Controller('electric')
export class ElectricCounterController {
    constructor(
        private counterService: ElectricCounterService,
        private saleService: ElectricSaleService,
    ) { }

    @HasPermission('counters_view')
    @Post('counters/v1/list')
    list(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.counterService.list(actor, body);
    }

    @Get('counters/list')
    dropdown(@Actor() actor: AuthActor, @Query('clientstore_id') clientstoreId: number) {
        return this.counterService.dropdown(actor, clientstoreId);
    }

    @Get('counters/mine')
    mine(@Actor() actor: AuthActor, @Query('clientstore_id') clientstoreId: number) {
        return this.counterService.mine(actor, clientstoreId);
    }

    @HasPermission('counters_create')
    @Post('counters')
    create(@Actor() actor: AuthActor, @Body() body: ElectricCounterDto) {
        return this.counterService.create(actor, body);
    }

    @HasPermission('counters_edit')
    @Put('counters/:id')
    update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: Partial<ElectricCounterDto>) {
        return this.counterService.update(actor, Number(id), body);
    }

    @HasPermission('counters_delete')
    @Delete('counters/:id')
    remove(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.counterService.remove(actor, Number(id));
    }

    @HasPermission('counters_cash_flow')
    @Get('counters/:id/cash-flow')
    cashFlow(@Actor() actor: AuthActor, @Param('id') id: number, @Query('date') date?: string) {
        return this.counterService.cashFlow(actor, Number(id), date);
    }

    @Get('counter-sessions/current')
    current(@Actor() actor: AuthActor, @Query('clientstore_id') clientstoreId: number, @Query('session_id') sessionId?: number) {
        return this.counterService.current(actor, clientstoreId, sessionId);
    }

    @HasPermission('counters_open_close')
    @Get('counter-sessions/open-list')
    openSessions(@Actor() actor: AuthActor, @Query('clientstore_id') clientstoreId: number) {
        return this.counterService.openSessions(actor, clientstoreId);
    }

    @Post('counter-sessions/open')
    open(@Actor() actor: AuthActor, @Body() body: { counter_id: number; opening_cash: number }) {
        return this.counterService.open(actor, body);
    }

    @Get('counter-sessions/:id')
    async session(@Actor() actor: AuthActor, @Param('id') id: number) {
        const session = await this.counterService.session(actor, Number(id));
        return {
            ...(await this.counterService.sessionView(session)),
            cash_moves: await this.counterService.cashMoves(session.id),
            pending_items: await this.saleService.pendingItems(session.clientstore_id, { status: 'Pending', sessionId: session.id }),
        };
    }

    @HasPermission('counters_cash_in', 'counters_cash_out')
    @Post('counter-sessions/:id/cash-moves')
    addMove(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: any) {
        return this.counterService.addMove(actor, Number(id), body);
    }

    @HasPermission('counters_open_close')
    @Post('counter-sessions/:id/close')
    close(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: any) {
        return this.counterService.close(actor, Number(id), body);
    }
}
