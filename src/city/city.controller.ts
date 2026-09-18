import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { activeStatusCondition, buildWhere, dateRangeCondition, growth, ListQueryDto, previousDateRangeCondition, sortOrder } from 'src/common/list-query';
import { ExportService } from 'src/common/export.service';
import { Public } from 'src/common/public.decorator';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { CityService } from './city.service';
import { CityCreateDto } from './models/city-create.dto';
import { CityUpdateDto } from './models/city-update.dto';

class CityListDto extends ListQueryDto {
    country_id?: number;
}

@Controller('cities')
export class CityController {
    constructor(
        private cityService: CityService,
        private exportService: ExportService
    ) { }

    private andConditions(body: CityListDto, dateCondition: any) {
        const andConditions: any = { ...dateCondition, ...activeStatusCondition(body.status) };
        if (body.country_id) {
            andConditions.country = { id: body.country_id };
        }
        return andConditions;
    }

    private listWhere(body: CityListDto) {
        return buildWhere(['name', 'country.name'], body.search, this.andConditions(body, dateRangeCondition(body.startDate, body.endDate)));
    }

    @HasPermission('cities_view')
    @Post('v1/kpis')
    async kpis(@Body() body: CityListDto) {
        const current = this.andConditions(body, dateRangeCondition(body.startDate, body.endDate));
        const previous = this.andConditions(body, previousDateRangeCondition(body.startDate, body.endDate));
        const totalCities = await this.cityService.count(current);
        const activeCities = await this.cityService.count({ ...current, is_active: true });
        const inactiveCities = await this.cityService.count({ ...current, is_active: false });
        const previousTotal = body.startDate && body.endDate ? await this.cityService.count(previous) : 0;
        return {
            totalCities,
            totalCitiesGrowth: growth(totalCities, previousTotal, body.startDate, body.endDate),
            activeCities,
            inactiveCities,
        };
    }

    @HasPermission('cities_view')
    @Post('v1/list')
    async list(@Body() body: CityListDto) {
        return this.cityService.paginatedFindByColumns(
            { id: true, name: true, is_active: true, created_at: true, country: { id: true, name: true } },
            ['country'],
            this.listWhere(body),
            body.page || 1,
            body.take || 10,
            sortOrder(body.sortBy),
        );
    }

    @Public()
    @Get('list')
    async dropdown(@Query('country_id') countryId?: number) {
        const where: any = { is_active: true };
        if (countryId) {
            where.country = { id: countryId };
        }
        return this.cityService.findByColumns({ id: true, name: true, country: { id: true } }, ['country'], where, { name: 'ASC' });
    }

    @HasPermission('cities_create')
    @Post()
    async create(@Body() body: CityCreateDto) {
        const { country_id, ...data } = body;
        return this.cityService.create({ ...data, country: { id: country_id } });
    }

    @HasPermission('cities_view')
    @Get(':id')
    async get(@Param('id') id: number) {
        const city = await this.cityService.findOne({ id }, ['country']);
        if (!city) {
            throw new NotFoundException('City not found');
        }
        return city;
    }

    @HasPermission('cities_edit')
    @Put(':id')
    async update(@Param('id') id: number, @Body() body: CityUpdateDto) {
        await this.get(id);
        const { country_id, ...data } = body;
        await this.cityService.update(id, { ...data, ...(country_id ? { country: { id: country_id } } : {}) });
        return this.get(id);
    }

    @HasPermission('cities_delete')
    @Delete(':id')
    async delete(@Param('id') id: number) {
        await this.get(id);
        return this.cityService.softDelete(id);
    }

    @HasPermission('cities_view')
    @Post('export/:format')
    async export(@Param('format') format: string, @Body() body: CityListDto, @Res() res: Response) {
        const response = await this.cityService.paginatedFindByColumns({}, ['country'], this.listWhere(body), 1, 100000, sortOrder(body.sortBy));
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Country', key: 'country', width: 25, value: (row: any) => row.country?.name },
            { header: 'Status', key: 'is_active', width: 12 },
            { header: 'Created At', key: 'created_at', width: 22 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Cities', columns, response.data);
        }
        return this.exportService.excel(res, 'Cities', columns, response.data);
    }
}
