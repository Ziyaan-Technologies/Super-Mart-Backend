import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { ElectricApi } from 'src/common/electric-api.decorator';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { ElectricUserService } from './electric-user.service';
import { ElectricListDto } from 'src/common/electric.dto';
import { ElectricRoleDto, ElectricUserDto } from './models/electric-user.dto';

@ElectricApi()
@ActorTypes(ActorType.CLIENT)
@Controller('electric')
export class ElectricUserController {
    constructor(private userService: ElectricUserService) { }

    @HasPermission('roles_view')
    @Get('permissions/list')
    permissions() {
        return this.userService.permissions();
    }

    @HasPermission('roles_view')
    @Post('roles/v1/list')
    listRoles(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.userService.listRoles(actor, body);
    }

    @HasPermission('roles_view', 'users_create', 'users_edit')
    @Get('roles/list')
    roles(@Actor() actor: AuthActor) {
        return this.userService.dropdownRoles(actor);
    }

    @HasPermission('roles_view')
    @Get('roles/:id')
    role(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.userService.role(actor, Number(id));
    }

    @HasPermission('roles_create')
    @Post('roles')
    createRole(@Actor() actor: AuthActor, @Body() body: ElectricRoleDto) {
        return this.userService.createRole(actor, body);
    }

    @HasPermission('roles_edit')
    @Put('roles/:id')
    updateRole(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ElectricRoleDto) {
        return this.userService.updateRole(actor, Number(id), body);
    }

    @HasPermission('roles_delete')
    @Delete('roles/:id')
    deleteRole(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.userService.deleteRole(actor, Number(id));
    }

    @HasPermission('users_view')
    @Post('clients/v1/list')
    listUsers(@Actor() actor: AuthActor, @Body() body: ElectricListDto) {
        return this.userService.listUsers(actor, body);
    }

    @HasPermission('users_create')
    @Post('clients')
    createUser(@Actor() actor: AuthActor, @Body() body: ElectricUserDto) {
        return this.userService.createUser(actor, body);
    }

    @HasPermission('users_edit')
    @Put('clients/:id')
    updateUser(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: ElectricUserDto) {
        return this.userService.updateUser(actor, Number(id), body);
    }

    @HasPermission('users_delete')
    @Delete('clients/:id')
    deleteUser(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.userService.deleteUser(actor, Number(id));
    }
}
