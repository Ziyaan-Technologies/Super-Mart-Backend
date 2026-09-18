import { Body, Controller, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { buildWhere, ListQueryDto } from 'src/common/list-query';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from './has-permission.decorator';
import { PermissionType } from './permission.entity';
import { PermissionService } from './permission.service';

class PermissionListDto extends ListQueryDto {
    moduleName?: string;
    type?: PermissionType;
}

@Controller('permissions')
export class PermissionController {
    constructor(
        private permissionService: PermissionService,
        private exportService: ExportService
    ) { }

    private scopedType(actor: AuthActor, type?: PermissionType) {
        return actor.type === ActorType.ADMIN ? type : PermissionType.VENDOR;
    }

    private listWhere(actor: AuthActor, body: PermissionListDto) {
        const andConditions: any = {};
        const type = this.scopedType(actor, body.type);
        if (type) {
            andConditions.type = type;
        }
        if (body.moduleName) {
            andConditions.module_name = body.moduleName;
        }
        return buildWhere(['name', 'permission_key', 'module_name'], body.search, andConditions);
    }

    @HasPermission('permissions_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor) {
        const type = this.scopedType(actor);
        const allPermissions = await this.permissionService.count(type ? { type } : {});
        const modules = await this.permissionService.findModules(type);
        const adminPermissions = actor.type === ActorType.ADMIN ? await this.permissionService.count({ type: PermissionType.ADMIN }) : 0;
        const vendorPermissions = await this.permissionService.count({ type: PermissionType.VENDOR });
        return {
            allPermissions,
            moduleGroups: modules.length,
            adminPermissions,
            vendorPermissions,
        };
    }

    @HasPermission('permissions_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: PermissionListDto) {
        return this.permissionService.paginatedFindByColumns(
            {},
            [],
            this.listWhere(actor, body),
            body.page || 1,
            body.take || 10,
            { module_name: 'ASC', id: 'ASC' },
        );
    }

    @Get('list')
    async grouped(@Actor() actor: AuthActor, @Query('type') type?: PermissionType) {
        const scopedType = this.scopedType(actor, type);
        const permissions = await this.permissionService.findByColumns(
            { id: true, name: true, permission_key: true, module_name: true, type: true },
            [],
            scopedType ? { type: scopedType } : {},
            { module_name: 'ASC', id: 'ASC' },
        );
        const groups = new Map<string, any>();
        permissions.forEach((permission) => {
            const groupKey = `${permission.type}:${permission.module_name}`;
            if (!groups.has(groupKey)) {
                groups.set(groupKey, { module_name: permission.module_name, type: permission.type, permissions: [] });
            }
            groups.get(groupKey).permissions.push(permission);
        });
        return Array.from(groups.values());
    }

    @Get('moduleList')
    async moduleList(@Actor() actor: AuthActor, @Query('type') type?: PermissionType) {
        return this.permissionService.findModules(this.scopedType(actor, type));
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('permissions_edit')
    @Put(':id')
    async update(@Param('id') id: number, @Body('name') name: string) {
        await this.permissionService.update(id, { name });
        return this.permissionService.findOne({ id });
    }

    @HasPermission('permissions_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: PermissionListDto, @Res() res: Response) {
        const response = await this.permissionService.paginatedFindByColumns({}, [], this.listWhere(actor, body), 1, 100000, { module_name: 'ASC', id: 'ASC' });
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'name', width: 30 },
            { header: 'Key', key: 'permission_key', width: 30 },
            { header: 'Module', key: 'module_name', width: 25 },
            { header: 'Type', key: 'type', width: 15 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Permissions', columns, response.data);
        }
        return this.exportService.excel(res, 'Permissions', columns, response.data);
    }
}
