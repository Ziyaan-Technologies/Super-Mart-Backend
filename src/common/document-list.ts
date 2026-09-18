import { SelectQueryBuilder } from 'typeorm';
import * as moment from 'moment-timezone';
import { ActorType, AuthActor } from './auth-actor';

export interface DocumentListFilter {
    vendorId?: number;
    clientstoreId?: number;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
}

export function applyDocumentFilters(
    query: SelectQueryBuilder<any>,
    alias: string,
    actor: AuthActor,
    filter: DocumentListFilter,
    options: { storeColumns: string[]; dateColumn: string; searchColumns: string[]; timestampDate?: boolean },
) {
    if (filter.vendorId) {
        query.andWhere(`${alias}.vendor_id = :vendorId`, { vendorId: filter.vendorId });
    }
    const storeId = actor.type === ActorType.CLIENT && actor.clientstore_id ? actor.clientstore_id : filter.clientstoreId;
    if (storeId) {
        query.andWhere(`(${options.storeColumns.map((column) => `${alias}.${column} = :storeId`).join(' OR ')})`, { storeId });
    }
    if (filter.status && filter.status !== 'All Statuses') {
        query.andWhere(`${alias}.status = :status`, { status: filter.status });
    }
    if (filter.search) {
        query.andWhere(`(${options.searchColumns.map((column) => `${column} LIKE :search`).join(' OR ')})`, { search: `%${filter.search}%` });
    }
    if (filter.startDate && filter.endDate) {
        query.andWhere(`${alias}.${options.dateColumn} BETWEEN :startDate AND :endDate`, options.timestampDate
            ? {
                startDate: moment(new Date(filter.startDate)).startOf('day').toDate(),
                endDate: moment(new Date(filter.endDate)).endOf('day').toDate(),
            }
            : {
                startDate: moment(new Date(filter.startDate)).format('YYYY-MM-DD'),
                endDate: moment(new Date(filter.endDate)).format('YYYY-MM-DD'),
            });
    }
    return query;
}

export async function paginateQuery(query: SelectQueryBuilder<any>, page: number, take: number) {
    const [data, total] = await query.skip((page - 1) * take).take(take).getManyAndCount();
    return {
        data,
        meta: {
            total,
            page: Math.ceil(page),
            last_page: Math.ceil(total / take),
        },
    };
}
