import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Not, Repository } from 'typeorm';
import { AuthActor } from './auth-actor';
import { paginateQuery } from './document-list';
import { ElectricListDto, ElectricNamedDto, ElectricNamedUpdateDto } from './electric.dto';
import { ElectricAccessService } from 'src/electric-access/electric-access.service';

export abstract class ElectricNamedService {
    protected abstract readonly label: string;
    protected abstract readonly alias: string;
    protected abstract readonly productColumn: string;

    protected constructor(
        protected readonly access: ElectricAccessService,
        protected readonly repository: Repository<any>,
        protected readonly dataSource: DataSource,
    ) { }

    protected order(query: any) {
        return query.orderBy(`${this.alias}.id`, 'DESC');
    }

    protected extraFields(body: ElectricNamedDto | ElectricNamedUpdateDto, current?: any) {
        return {};
    }

    async productCounts(ids: number[]) {
        if (!ids.length) return new Map<number, number>();
        const rows = await this.dataSource.query(
            `SELECT ${this.productColumn} AS id, COUNT(*) AS count FROM electric_products WHERE deleted_at IS NULL AND ${this.productColumn} IN (?) GROUP BY ${this.productColumn}`,
            [ids],
        );
        return new Map<number, number>(rows.map((row: any) => [Number(row.id), Number(row.count)]));
    }

    protected async assertUniqueName(shopId: number, name: string, exceptId?: number) {
        const clean = String(name || '').trim();
        if (!clean) {
            throw new BadRequestException('Name is required');
        }
        const where: any = { clientstore: { id: shopId }, name: clean };
        if (exceptId) where.id = Not(exceptId);
        if (await this.repository.findOne({ where })) {
            throw new BadRequestException(`"${clean}" already exists`);
        }
        return clean;
    }

    async list(actor: AuthActor, body: ElectricListDto) {
        const shop = await this.access.shop(actor, body.clientstore_id);
        const query = this.repository.createQueryBuilder(this.alias).where(`${this.alias}.clientstore_id = :shopId`, { shopId: shop.id });
        if (body.search) {
            query.andWhere(`(${this.alias}.name LIKE :search OR ${this.alias}.description LIKE :search)`, { search: `%${body.search}%` });
        }
        if (body.status) {
            query.andWhere(`${this.alias}.is_active = :active`, { active: body.status === 'Active' });
        }
        const result = await paginateQuery(this.order(query), Number(body.page) || 1, Number(body.take) || 10);
        const counts = await this.productCounts(result.data.map((row: any) => row.id));
        return { ...result, data: result.data.map((row: any) => ({ ...row, product_count: counts.get(row.id) || 0 })) };
    }

    async dropdown(actor: AuthActor, clientstoreId: any) {
        const shop = await this.access.shop(actor, clientstoreId);
        return this.repository.find({ where: { clientstore: { id: shop.id }, is_active: true }, order: { name: 'ASC' } });
    }

    async create(actor: AuthActor, body: ElectricNamedDto) {
        const shop = await this.access.shop(actor, body.clientstore_id);
        const saved = await this.repository.save({
            vendor: { id: actor.vendor_id },
            clientstore: { id: shop.id },
            name: await this.assertUniqueName(shop.id, body.name),
            description: body.description || '',
            image_url: body.image_url || '',
            is_active: body.is_active !== false,
            ...this.extraFields(body),
        });
        return this.repository.findOne({ where: { id: saved.id } });
    }

    async own(actor: AuthActor, id: number) {
        const row = await this.repository.findOne({ where: { id } });
        if (!row) {
            throw new NotFoundException(`${this.label} not found`);
        }
        await this.access.shop(actor, row.clientstore_id);
        return row;
    }

    async update(actor: AuthActor, id: number, body: ElectricNamedUpdateDto) {
        const row = await this.own(actor, id);
        await this.repository.update(row.id, {
            name: await this.assertUniqueName(row.clientstore_id, body.name ?? row.name, row.id),
            description: body.description ?? row.description,
            image_url: body.image_url ?? row.image_url,
            is_active: body.is_active ?? row.is_active,
            ...this.extraFields(body, row),
        });
        return this.repository.findOne({ where: { id: row.id } });
    }

    async remove(actor: AuthActor, id: number) {
        const row = await this.own(actor, id);
        if ((await this.productCounts([row.id])).get(row.id)) {
            throw new BadRequestException(`This ${this.label.toLowerCase()} has products. Move or delete them first.`);
        }
        await this.repository.softDelete(row.id);
        return { message: `${this.label} deleted` };
    }
}
