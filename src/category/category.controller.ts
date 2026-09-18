import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { IsNull } from 'typeorm';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { activeStatusCondition, buildWhere, dateRangeCondition, growth, previousDateRangeCondition, sortOrder } from 'src/common/list-query';
import { requiredVendorId, scopedVendorId } from 'src/common/tenant-scope';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { CategoryService } from './category.service';
import { CategoryCreateDto, CategoryListDto, CategoryUpdateDto } from './models/category.dto';

@ActorTypes(ActorType.ADMIN, ActorType.CLIENT)
@Controller('categories')
export class CategoryController {
    constructor(
        private categoryService: CategoryService,
        private exportService: ExportService
    ) { }

    private andConditions(actor: AuthActor, body: CategoryListDto, dateCondition: any) {
        const andConditions: any = { ...dateCondition, ...activeStatusCondition(body.status) };
        const vendorId = scopedVendorId(actor, body.vendor_id);
        if (vendorId) {
            andConditions.vendor = { id: vendorId };
        }
        if (body.parent_id === 'root') {
            andConditions.parent = IsNull();
        } else if (body.parent_id) {
            andConditions.parent = { id: body.parent_id };
        }
        if (body.level) {
            andConditions.level = body.level;
        }
        return andConditions;
    }

    private listWhere(actor: AuthActor, body: CategoryListDto) {
        return buildWhere(['name', 'parent.name'], body.search, this.andConditions(actor, body, dateRangeCondition(body.startDate, body.endDate)));
    }

    @HasPermission('categories_view')
    @Post('v1/kpis')
    async kpis(@Actor() actor: AuthActor, @Body() body: CategoryListDto) {
        const current = this.andConditions(actor, body, dateRangeCondition(body.startDate, body.endDate));
        const previous = this.andConditions(actor, body, previousDateRangeCondition(body.startDate, body.endDate));
        const totalCategories = await this.categoryService.count(current);
        const activeCategories = await this.categoryService.count({ ...current, is_active: true });
        const departments = await this.categoryService.count({ ...current, level: 1 });
        const previousTotal = body.startDate && body.endDate ? await this.categoryService.count(previous) : 0;
        return {
            totalCategories,
            totalCategoriesGrowth: growth(totalCategories, previousTotal, body.startDate, body.endDate),
            activeCategories,
            departments,
        };
    }

    @HasPermission('categories_view')
    @Post('v1/list')
    async list(@Actor() actor: AuthActor, @Body() body: CategoryListDto) {
        return this.categoryService.paginatedFindByColumns(
            {},
            ['vendor', 'parent'],
            this.listWhere(actor, body),
            body.page || 1,
            body.take || 10,
            body.sortBy ? sortOrder(body.sortBy) : { level: 'ASC', sort_order: 'ASC', name: 'ASC' },
        );
    }

    @Get('tree')
    async tree(@Actor() actor: AuthActor, @Query('vendor_id') vendorId?: number, @Query('active') active = '1') {
        return this.categoryService.tree(requiredVendorId(actor, vendorId), active === '1');
    }

    @Get('list')
    async dropdown(@Actor() actor: AuthActor, @Query('vendor_id') vendorId?: number) {
        const tree = await this.categoryService.tree(requiredVendorId(actor, vendorId), true);
        const flat: any[] = [];
        const walk = (nodes: any[]) => nodes.forEach((node) => {
            flat.push({ id: node.id, name: node.name, level: node.level, parent_id: node.parent_id, path: node.path });
            walk(node.children);
        });
        walk(tree);
        return flat;
    }

    @HasPermission('categories_create')
    @Post()
    async create(@Actor() actor: AuthActor, @Body() body: CategoryCreateDto) {
        const vendorId = requiredVendorId(actor, body.vendor_id);
        const { parent, level } = await this.categoryService.resolveParent(vendorId, body.parent_id || null);
        await this.categoryService.assertUniqueInParent(vendorId, parent?.id || null, body.name);
        const { vendor_id, parent_id, ...data } = body;
        const category = await this.categoryService.create({
            ...data,
            level,
            parent: parent ? { id: parent.id } : null,
            vendor: { id: vendorId },
        });
        return this.get(actor, category.id);
    }

    @HasPermission('categories_view')
    @Get(':id')
    async get(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.categoryService.accessible(actor, id, ['vendor', 'parent', 'children']);
    }

    @HasPermission('categories_edit')
    @Put(':id')
    async update(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: CategoryUpdateDto) {
        const category = await this.categoryService.accessible(actor, id);
        const { vendor_id, parent_id, ...data } = body;
        const changes: any = { ...data };
        let parentId = category.parent_id || null;
        if (parent_id !== undefined) {
            const resolved = await this.categoryService.resolveParent(category.vendor_id, parent_id || null, category.id);
            parentId = resolved.parent?.id || null;
            changes.parent = parentId ? { id: parentId } : null;
            changes.level = resolved.level;
        }
        if (body.name || parent_id !== undefined) {
            await this.categoryService.assertUniqueInParent(category.vendor_id, parentId, body.name || category.name, category.id);
        }
        if (Object.keys(changes).length) {
            await this.categoryService.update(category.id, changes);
        }
        if (changes.level && changes.level !== category.level) {
            await this.categoryService.refreshChildLevels(category.id, changes.level);
        }
        return this.get(actor, category.id);
    }

    @HasPermission('categories_delete')
    @Delete(':id')
    async delete(@Actor() actor: AuthActor, @Param('id') id: number) {
        const category = await this.categoryService.accessible(actor, id);
        const usage = await this.categoryService.usage(category.id);
        if (usage.children) {
            throw new BadRequestException('Remove or move the sub-categories first');
        }
        if (usage.products) {
            throw new BadRequestException(`This category has ${usage.products} product(s). Move them first.`);
        }
        return this.categoryService.softDelete(category.id);
    }

    @HasPermission('categories_view')
    @Post('export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: CategoryListDto, @Res() res: Response) {
        const response = await this.categoryService.paginatedFindByColumns({}, ['vendor', 'parent'], this.listWhere(actor, body), 1, 100000, { level: 'ASC', sort_order: 'ASC', name: 'ASC' });
        const columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Parent', key: 'parent', width: 25, value: (row: any) => row.parent?.name },
            { header: 'Level', key: 'level', width: 10 },
            { header: 'Vendor', key: 'vendor', width: 25, value: (row: any) => row.vendor?.business_name },
            { header: 'Sort', key: 'sort_order', width: 10 },
            { header: 'Status', key: 'is_active', width: 12 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Categories', columns, response.data);
        }
        return this.exportService.excel(res, 'Categories', columns, response.data);
    }
}
