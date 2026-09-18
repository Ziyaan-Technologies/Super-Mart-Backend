import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PaginatedResult } from './paginated-result.interface';

@Injectable()
export abstract class AbstractService {
    protected constructor(
        protected readonly repository: Repository<any>
    ) {
    }

    async all(relations = []): Promise<any[]> {
        return this.repository.find({ relations });
    }

    async paginatefind(condition: any, page: number = 1, take: number = 25, relations = []): Promise<PaginatedResult> {
        const [data, total] = await this.repository.findAndCount({
            where: condition,
            relations: relations,
            order: {
                id: "DESC"
            },
            skip: (page - 1) * take,
            take,
        });

        return {
            data: data,
            meta: {
                total,
                page: Math.ceil(page),
                last_page: Math.ceil(total / take)
            }
        }
    }

    async paginatedFindByColumns(
        columns = {},
        relations = [],
        condition: any,
        page: number = 1,
        take: number = 25,
        order = {},
        relationLoadStrategy: any = "join",
    ): Promise<PaginatedResult> {
        const [data, total] = await this.repository.findAndCount({
            select: columns,
            relations: relations,
            where: condition,
            take,
            skip: (page - 1) * take,
            order: order,
            relationLoadStrategy: relationLoadStrategy,
        });

        return {
            data: data,
            meta: {
                total,
                page: Math.ceil(page),
                last_page: Math.ceil(total / take)
            }
        }
    }

    async create(data): Promise<any> {
        return this.repository.save(data);
    }

    async findOne(condition: any, relations = []): Promise<any> {
        return this.repository.findOne({
            where: condition,
            relations: relations
        })
    }

    async find(condition: any): Promise<any> {
        return this.repository.find({
            where: condition,
        });
    }

    async findWithRelations(condition: any, relations = []): Promise<any> {
        return this.repository.find({
            where: condition,
            relations: relations
        });
    }

    async findByColumns(
        columns = {},
        relations = [],
        condition: any,
        order = {},
    ): Promise<any[]> {
        return this.repository.find({
            select: columns,
            relations: relations,
            where: condition,
            order: order,
        });
    }

    async count(condition: any): Promise<number> {
        return await this.repository.count({
            where: condition
        });
    }

    async update(id: number, data): Promise<any> {
        return this.repository.update(id, data);
    }

    async updateWithCondition(condition: any, data): Promise<any> {
        return this.repository.update(condition, data);
    }

    async increment(condition: any, column: string, value: number): Promise<any> {
        return this.repository.increment(condition, column, value);
    }

    async delete(id: number): Promise<any> {
        return this.repository.delete(id);
    }

    async softDelete(id: number): Promise<any> {
        return this.repository.softDelete(id);
    }

    async restore(id: number): Promise<any> {
        return this.repository.restore(id);
    }
}
