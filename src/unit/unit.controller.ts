import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Res } from '@nestjs/common';
import { Response } from 'express';
import { Not } from 'typeorm';
import { ActorType } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { activeStatusCondition, buildWhere, dateRangeCondition, sortOrder } from 'src/common/list-query';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { UnitService } from './unit.service';
import { UnitType } from './models/unit.entity';
import { UnitCreateDto, UnitListDto, UnitUpdateDto } from './models/unit.dto';

@Controller('units')
export class UnitController {
    constructor(
        private unitService: UnitService,
        private exportService: ExportService
    ) { }

    private andConditions(body: UnitListDto) {
        const andConditions: any = { ...dateRangeCondition(body.startDate, body.endDate), ...activeStatusCondition(body.status) };
        if (body.type) {
            andConditions.type = body.type;
        }
        return andConditions;
    }

    private listWhere(body: UnitListDto) {
        return buildWhere(['name', 'short_name'], body.search, this.andConditions(body));
    }

    private async assertUnique(body: Partial<UnitCreateDto>, exceptId?: number) {
        const conditions: any[] = [];
        if (body.name) conditions.push({ name: body.name });
        if (body.short_name) conditions.push({ short_name: body.short_name });
        if (!conditions.length) return;
        const existing = await this.unitService.findOne(conditions.map((condition) => exceptId ? { ...condition, id: Not(exceptId) } : condition));
        if (existing) {
            throw new BadRequestException('A unit with this name or short name already exists');
        }
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('units_view')
    @Post('v1/kpis')
    async kpis() {
        const totalUnits = await this.unitService.count({});
        const activeUnits = await this.unitService.count({ is_active: true });
        const weightUnits = await this.unitService.count({ type: UnitType.WEIGHT });
        const volumeUnits = await this.unitService.count({ type: UnitType.VOLUME });
        return { totalUnits, activeUnits, weightUnits, volumeUnits };
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('units_view')
    @Post('v1/list')
    async list(@Body() body: UnitListDto) {
        return this.unitService.paginatedFindByColumns({}, [], this.listWhere(body), body.page || 1, body.take || 10, sortOrder(body.sortBy));
    }

    @ActorTypes(ActorType.ADMIN, ActorType.CLIENT)
    @Get('list')
    async dropdown() {
        return this.unitService.findByColumns({ id: true, name: true, short_name: true, type: true, allow_decimal: true }, [], { is_active: true }, { name: 'ASC' });
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('units_create')
    @Post()
    async create(@Body() body: UnitCreateDto) {
        await this.assertUnique(body);
        return this.unitService.create(body);
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('units_view')
    @Get(':id')
    async get(@Param('id') id: number) {
        const unit = await this.unitService.findOne({ id });
        if (!unit) {
            throw new NotFoundException('Unit not found');
        }
        return unit;
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('units_edit')
    @Put(':id')
    async update(@Param('id') id: number, @Body() body: UnitUpdateDto) {
        await this.get(id);
        await this.assertUnique(body, id);
        if (Object.keys(body).length) {
            await this.unitService.update(id, { ...body });
        }
        return this.get(id);
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('units_delete')
    @Delete(':id')
    async delete(@Param('id') id: number) {
        await this.get(id);
        if (await this.unitService.usageCount(id)) {
            throw new BadRequestException('This unit is used by products and cannot be deleted');
        }
        return this.unitService.softDelete(id);
    }

    @ActorTypes(ActorType.ADMIN)
    @HasPermission('units_view')
    @Post('export/:format')
    async export(@Param('format') format: string, @Body() body: UnitListDto, @Res() res: Response) {
        const response = await this.unitService.paginatedFindByColumns({}, [], this.listWhere(body), 1, 100000, sortOrder(body.sortBy));
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'name', width: 22 },
            { header: 'Short Name', key: 'short_name', width: 14 },
            { header: 'Type', key: 'type', width: 14 },
            { header: 'Decimal', key: 'allow_decimal', width: 12, value: (row: any) => (row.allow_decimal ? 'Yes' : 'No') },
            { header: 'Status', key: 'is_active', width: 12 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Units', columns, response.data);
        }
        return this.exportService.excel(res, 'Units', columns, response.data);
    }
}
