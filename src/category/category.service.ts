import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { VendorScopedService } from 'src/common/vendor-scoped.service';
import { Category } from './models/category.entity';

export const MAX_CATEGORY_LEVEL = 3;

@Injectable()
export class CategoryService extends VendorScopedService {
    protected readonly label = 'Category';

    constructor(
        @InjectRepository(Category, 'MainConnection') private readonly categoryRepository: Repository<Category>
    ) {
        super(categoryRepository);
    }

    async assertUniqueInParent(vendorId: number, parentId: number | null, name: string, exceptId?: number) {
        const condition: any = { vendor: { id: vendorId }, parent: parentId ? { id: parentId } : IsNull(), name };
        if (exceptId) {
            condition.id = Not(exceptId);
        }
        if (await this.categoryRepository.findOne({ where: condition })) {
            throw new BadRequestException(`A category named "${name}" already exists at this level`);
        }
    }

    async resolveParent(vendorId: number, parentId: number | null, categoryId?: number) {
        if (!parentId) {
            return { parent: null, level: 1 };
        }
        const parent = await this.assertOwnedByVendor(parentId, vendorId);
        if (parent.level >= MAX_CATEGORY_LEVEL) {
            throw new BadRequestException(`Categories can only be nested ${MAX_CATEGORY_LEVEL} levels deep`);
        }
        if (categoryId) {
            let cursor = parent;
            while (cursor) {
                if (cursor.id === Number(categoryId)) {
                    throw new BadRequestException('A category cannot be moved under itself');
                }
                cursor = cursor.parent_id ? await this.categoryRepository.findOne({ where: { id: cursor.parent_id } }) : null;
            }
            const depth = await this.subtreeDepth(categoryId);
            if (parent.level + depth > MAX_CATEGORY_LEVEL) {
                throw new BadRequestException(`Categories can only be nested ${MAX_CATEGORY_LEVEL} levels deep`);
            }
        }
        return { parent, level: parent.level + 1 };
    }

    async subtreeDepth(categoryId: number): Promise<number> {
        const children = await this.categoryRepository.find({ where: { parent: { id: categoryId } } });
        if (!children.length) {
            return 1;
        }
        const depths = await Promise.all(children.map((child) => this.subtreeDepth(child.id)));
        return 1 + Math.max(...depths);
    }

    async refreshChildLevels(categoryId: number, level: number) {
        const children = await this.categoryRepository.find({ where: { parent: { id: categoryId } } });
        for (const child of children) {
            await this.categoryRepository.update(child.id, { level: level + 1 });
            await this.refreshChildLevels(child.id, level + 1);
        }
    }

    async descendantIds(categoryId: number): Promise<number[]> {
        const ids = [Number(categoryId)];
        let frontier = [Number(categoryId)];
        while (frontier.length) {
            const rows = await this.categoryRepository
                .createQueryBuilder('category')
                .select('category.id', 'id')
                .where('category.parent_id IN (:...ids)', { ids: frontier })
                .getRawMany();
            frontier = rows.map((row) => Number(row.id));
            ids.push(...frontier);
        }
        return ids;
    }

    async tree(vendorId: number, activeOnly: boolean) {
        const where: any = { vendor: { id: vendorId } };
        if (activeOnly) {
            where.is_active = true;
        }
        const categories = await this.categoryRepository.find({ where, order: { sort_order: 'ASC', name: 'ASC' } });
        const byParent = new Map<number | null, any[]>();
        categories.forEach((category) => {
            const key = category.parent_id || null;
            if (!byParent.has(key)) {
                byParent.set(key, []);
            }
            byParent.get(key).push(category);
        });
        const build = (parentId: number | null, path: string[]): any[] =>
            (byParent.get(parentId) || []).map((category) => {
                const categoryPath = [...path, category.name];
                return {
                    id: category.id,
                    name: category.name,
                    level: category.level,
                    parent_id: category.parent_id || null,
                    image_url: category.image_url,
                    sort_order: category.sort_order,
                    is_active: category.is_active,
                    path: categoryPath.join(' / '),
                    children: build(category.id, categoryPath),
                };
            });
        return build(null, []);
    }

    async usage(categoryId: number) {
        const [{ children }] = await this.categoryRepository.query('SELECT COUNT(*) AS children FROM categories WHERE parent_id = ? AND deleted_at IS NULL', [categoryId]);
        const [{ products }] = await this.categoryRepository.query('SELECT COUNT(*) AS products FROM products WHERE category_id = ? AND deleted_at IS NULL', [categoryId]);
        return { children: Number(children), products: Number(products) };
    }
}
