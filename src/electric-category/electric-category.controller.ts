import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { ElectricApi } from 'src/common/electric-api.decorator';
import { ElectricListDto, ElectricNamedDto, ElectricNamedUpdateDto } from 'src/common/electric.dto';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ElectricCategoryService } from './electric-category.service';

@ElectricApi()
@ActorTypes(ActorType.CLIENT)
@Controller('electric/categories')
export class ElectricCategoryController {
    constructor(private categoryService: ElectricCategoryService) { }

    @HasPermission('categories_view')
    @Post('v1/list')
    list(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.categoryService.list(actor, body);
    }

    @Get('list')
    dropdown(@Actor() actor: AuthActor, @Query('clientstore_id') clientstoreId: number) {
        return this.categoryService.dropdown(actor, clientstoreId);
    }

    @HasPermission('categories_create')
    @Post()
    create(@Actor() actor: AuthActor, @Body() body: ElectricNamedDto) {
        return this.categoryService.create(actor, body);
    }

    @HasPermission('categories_edit')
    @Put(':id')
    update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ElectricNamedUpdateDto) {
        return this.categoryService.update(actor, Number(id), body);
    }

    @HasPermission('categories_delete')
    @Delete(':id')
    remove(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.categoryService.remove(actor, Number(id));
    }
}
