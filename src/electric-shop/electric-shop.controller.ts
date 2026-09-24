import { Controller, Get, Param, Query } from '@nestjs/common';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { ElectricApi } from 'src/common/electric-api.decorator';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ElectricAccessService } from 'src/electric-access/electric-access.service';
import { shopView } from 'src/common/electric-document';
import { ElectricCounterService } from 'src/electric-counter/electric-counter.service';
import { ElectricSaleService } from 'src/electric-sale/electric-sale.service';

@ElectricApi()
@ActorTypes(ActorType.CLIENT)
@Controller('electric')
export class ElectricShopController {
    constructor(
        private access: ElectricAccessService,
        private counterService: ElectricCounterService,
        private saleService: ElectricSaleService,
    ) { }

    @Get('clientstores/list')
    async shops(@Actor() actor: AuthActor) {
        return (await this.access.shops(actor)).map(shopView);
    }

    @HasPermission('shops_view')
    @Get('clientstores/cards')
    async cards(@Actor() actor: AuthActor) {
        const shops = await this.access.shops(actor);
        return Promise.all(shops.map(async (shop) => this.saleService.shopCard(shop, await this.counterService.counterViews(shop.id))));
    }

    @Get('clientstores/:id')
    async shop(@Actor() actor: AuthActor, @Param('id') id: number) {
        return shopView(await this.access.shop(actor, id));
    }

    @HasPermission('home_view')
    @Get('dashboard/summary')
    async dashboard(@Actor() actor: AuthActor, @Query('clientstore_id') clientstoreId: number) {
        const shop = await this.access.shop(actor, clientstoreId);
        return this.saleService.dashboard(shop, await this.counterService.counterViews(shop.id));
    }
}
