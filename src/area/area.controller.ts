import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { activeStatusCondition, buildWhere, dateRangeCondition, growth, ListQueryDto, previousDateRangeCondition, sortOrder } from 'src/common/list-query';
import { ExportService } from 'src/common/export.service';
import { Public } from 'src/common/public.decorator';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { AreaService } from './area.service';
import { AreaCreateDto } from './models/area-create.dto';
import { AreaUpdateDto } from './models/area-update.dto';

class AreaListDto extends ListQueryDto {
    city_id?: number;
}

@Controller('areas')
export class AreaController {
    constructor(
        private areaService: AreaService,
        private exportService: ExportService
    ) { }

    private andConditions(body: AreaListDto, dateCondition: any) {
        const andConditions: any = { ...dateCondition, ...activeStatusCondition(body.status) };
        if (body.city_id) {
            andConditions.city = { id: body.city_id };
        }
        return andConditions;
    }

    private listWhere(body: AreaListDto) {
        return buildWhere(['name', 'city.name'], body.search, this.andConditions(body, dateRangeCondition(body.startDate, body.endDate)));
    }

    @HasPermission('areas_view')
    @Post('v1/kpis')
    async kpis(@Body() body: AreaListDto) {
        const current = this.andConditions(body, dateRangeCondition(body.startDate, body.endDate));
        const previous = this.andConditions(body, previousDateRangeCondition(body.startDate, body.endDate));
        const totalAreas = await this.areaService.count(current);
        const activeAreas = await this.areaService.count({ ...current, is_active: true });
        const inactiveAreas = await this.areaService.count({ ...current, is_active: false });
        const previousTotal = body.startDate && body.endDate ? await this.areaService.count(previous) : 0;
        return {
            totalAreas,
            totalAreasGrowth: growth(totalAreas, previousTotal, body.startDate, body.endDate),
            activeAreas,
            inactiveAreas,
        };
    }

    @HasPermission('areas_view')
    @Post('v1/list')
    async list(@Body() body: AreaListDto) {
        return this.areaService.paginatedFindByColumns(
            { id: true, name: true, is_active: true, created_at: true, city: { id: true, name: true } },
            ['city'],
            this.listWhere(body),
            body.page || 1,
            body.take || 10,
            sortOrder(body.sortBy),
        );
    }

    @Public()
    @Get('list')
    async dropdown(@Query('city_id') cityId?: number) {
        const where: any = { is_active: true };
        if (cityId) {
            where.city = { id: cityId };
        }
        return this.areaService.findByColumns({ id: true, name: true, city: { id: true } }, ['city'], where, { name: 'ASC' });
    }

    @HasPermission('areas_create')
    @Post()
    async create(@Body() body: AreaCreateDto) {
        const { city_id, ...data } = body;
        return this.areaService.create({ ...data, city: { id: city_id } });
    }

    @HasPermission('areas_view')
    @Get(':id')
    async get(@Param('id') id: number) {
        const area = await this.areaService.findOne({ id }, ['city']);
        if (!area) {
            throw new NotFoundException('Area not found');
        }
        return area;
    }

    @HasPermission('areas_edit')
    @Put(':id')
    async update(@Param('id') id: number, @Body() body: AreaUpdateDto) {
        await this.get(id);
        const { city_id, ...data } = body;
        await this.areaService.update(id, { ...data, ...(city_id ? { city: { id: city_id } } : {}) });
        return this.get(id);
    }

    @HasPermission('areas_delete')
    @Delete(':id')
    async delete(@Param('id') id: number) {
        await this.get(id);
        return this.areaService.softDelete(id);
    }

    @HasPermission('areas_view')
    @Post('export/:format')
    async export(@Param('format') format: string, @Body() body: AreaListDto, @Res() res: Response) {
        const response = await this.areaService.paginatedFindByColumns({}, ['city'], this.listWhere(body), 1, 100000, sortOrder(body.sortBy));
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'City', key: 'city', width: 25, value: (row: any) => row.city?.name },
            { header: 'Status', key: 'is_active', width: 12 },
            { header: 'Created At', key: 'created_at', width: 22 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Areas', columns, response.data);
        }
        return this.exportService.excel(res, 'Areas', columns, response.data);
    }
}
