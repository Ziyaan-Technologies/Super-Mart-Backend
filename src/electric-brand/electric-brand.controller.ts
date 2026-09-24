import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { ElectricApi } from 'src/common/electric-api.decorator';
import { ElectricListDto, ElectricNamedDto, ElectricNamedUpdateDto } from 'src/common/electric.dto';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ElectricBrandService } from './electric-brand.service';

@ElectricApi()
@ActorTypes(ActorType.CLIENT)
@Controller('electric/brands')
export class ElectricBrandController {
    constructor(private brandService: ElectricBrandService) { }

    @HasPermission('brands_view')
    @Post('v1/list')
    list(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.brandService.list(actor, body);
    }

    @Get('list')
    dropdown(@Actor() actor: AuthActor, @Query('clientstore_id') clientstoreId: number) {
        return this.brandService.dropdown(actor, clientstoreId);
    }

    @HasPermission('brands_create')
    @Post()
    create(@Actor() actor: AuthActor, @Body() body: ElectricNamedDto) {
        return this.brandService.create(actor, body);
    }

    @HasPermission('brands_edit')
    @Put(':id')
    update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ElectricNamedUpdateDto) {
        return this.brandService.update(actor, Number(id), body);
    }

    @HasPermission('brands_delete')
    @Delete(':id')
    remove(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.brandService.remove(actor, Number(id));
    }
}
