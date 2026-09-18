import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { activeStatusCondition, buildWhere, dateRangeCondition, growth, ListQueryDto, previousDateRangeCondition, sortOrder } from 'src/common/list-query';
import { ExportService } from 'src/common/export.service';
import { Public } from 'src/common/public.decorator';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { CountryService } from './country.service';
import { CountryCreateDto } from './models/country-create.dto';
import { CountryUpdateDto } from './models/country-update.dto';

@Controller('countries')
export class CountryController {
    constructor(
        private countryService: CountryService,
        private exportService: ExportService
    ) { }

    private listWhere(body: ListQueryDto) {
        return buildWhere(['name', 'country_code', 'currency_short_name'], body.search, {
            ...dateRangeCondition(body.startDate, body.endDate),
            ...activeStatusCondition(body.status),
        });
    }

    @HasPermission('countries_view')
    @Post('v1/kpis')
    async kpis(@Body() body: ListQueryDto) {
        const current = dateRangeCondition(body.startDate, body.endDate);
        const previous = previousDateRangeCondition(body.startDate, body.endDate);
        const totalCountries = await this.countryService.count(current);
        const activeCountries = await this.countryService.count({ ...current, is_active: true });
        const inactiveCountries = await this.countryService.count({ ...current, is_active: false });
        const previousTotal = body.startDate && body.endDate ? await this.countryService.count(previous) : 0;
        return {
            totalCountries,
            totalCountriesGrowth: growth(totalCountries, previousTotal, body.startDate, body.endDate),
            activeCountries,
            inactiveCountries,
        };
    }

    @HasPermission('countries_view')
    @Post('v1/list')
    async list(@Body() body: ListQueryDto) {
        return this.countryService.paginatedFindByColumns({}, [], this.listWhere(body), body.page || 1, body.take || 10, sortOrder(body.sortBy));
    }

    @Public()
    @Get('list')
    async dropdown(@Query('includeCities') includeCities = '0') {
        if (includeCities === '1') {
            return this.countryService.findByColumns(
                { id: true, name: true, country_code: true, phone_code: true, currency_short_name: true, currency_symbol: true, cities: { id: true, name: true } },
                ['cities'],
                { is_active: true },
                { name: 'ASC', cities: { name: 'ASC' } },
            );
        }
        return this.countryService.findByColumns(
            { id: true, name: true, country_code: true, phone_code: true, currency_short_name: true, currency_symbol: true },
            [],
            { is_active: true },
            { name: 'ASC' },
        );
    }

    @HasPermission('countries_create')
    @Post()
    async create(@Body() body: CountryCreateDto) {
        return this.countryService.create(body);
    }

    @HasPermission('countries_view')
    @Get(':id')
    async get(@Param('id') id: number) {
        const country = await this.countryService.findOne({ id });
        if (!country) {
            throw new NotFoundException('Country not found');
        }
        return country;
    }

    @HasPermission('countries_edit')
    @Put(':id')
    async update(@Param('id') id: number, @Body() body: CountryUpdateDto) {
        await this.get(id);
        await this.countryService.update(id, { ...body });
        return this.countryService.findOne({ id });
    }

    @HasPermission('countries_delete')
    @Delete(':id')
    async delete(@Param('id') id: number) {
        await this.get(id);
        return this.countryService.softDelete(id);
    }

    @HasPermission('countries_view')
    @Post('export/:format')
    async export(@Param('format') format: string, @Body() body: ListQueryDto, @Res() res: Response) {
        const response = await this.countryService.paginatedFindByColumns({}, [], this.listWhere(body), 1, 100000, sortOrder(body.sortBy));
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Code', key: 'country_code', width: 12 },
            { header: 'Currency', key: 'currency_short_name', width: 15 },
            { header: 'Time Zone', key: 'country_time_zone', width: 22 },
            { header: 'Status', key: 'is_active', width: 12 },
            { header: 'Created At', key: 'created_at', width: 22 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Countries', columns, response.data);
        }
        return this.exportService.excel(res, 'Countries', columns, response.data);
    }
}
