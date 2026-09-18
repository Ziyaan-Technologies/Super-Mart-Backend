import { Between, Like } from 'typeorm';
import * as moment from 'moment-timezone';

export class ListQueryDto {
    page?: number;
    take?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    startDate?: string;
    endDate?: string;
}

export class VendorScopedListDto extends ListQueryDto {
    vendor_id?: number;
}

export function dateRangeCondition(startDate?: string, endDate?: string, field = 'created_at') {
    if (!startDate || !endDate) {
        return {};
    }
    return {
        [field]: Between(
            moment(new Date(startDate)).startOf('day').toDate(),
            moment(new Date(endDate)).endOf('day').toDate()
        )
    };
}

export function previousDateRangeCondition(startDate?: string, endDate?: string, field = 'created_at') {
    if (!startDate || !endDate) {
        return {};
    }
    const start = moment(new Date(startDate)).startOf('day');
    const end = moment(new Date(endDate)).endOf('day');
    const durationDays = end.diff(start, 'days') + 1;
    return {
        [field]: Between(
            start.clone().subtract(durationDays, 'days').toDate(),
            end.clone().subtract(durationDays, 'days').toDate()
        )
    };
}

export function activeStatusCondition(status?: string, field = 'is_active') {
    if (!status || status === 'All Statuses') {
        return {};
    }
    if (status.toLowerCase() === 'active') {
        return { [field]: true };
    }
    if (status.toLowerCase() === 'inactive') {
        return { [field]: false };
    }
    return {};
}

export function buildWhere(searchFields: string[], search: string, andConditions: any) {
    if (!search || !searchFields.length) {
        return andConditions;
    }
    return searchFields.map((field) => {
        const parts = field.split('.');
        const condition: any = {};
        let cursor = condition;
        parts.forEach((part, index) => {
            if (index === parts.length - 1) {
                cursor[part] = Like(`%${search}%`);
            } else {
                cursor[part] = {};
                cursor = cursor[part];
            }
        });
        return mergeDeep(andConditions, condition);
    });
}

function mergeDeep(target: any, source: any) {
    const output = { ...target };
    Object.keys(source).forEach((key) => {
        const value = source[key];
        const isPlainObject = value && typeof value === 'object' && value.constructor === Object;
        if (isPlainObject && output[key] && output[key].constructor === Object) {
            output[key] = mergeDeep(output[key], value);
        } else {
            output[key] = value;
        }
    });
    return output;
}

export function sortOrder(sortBy?: string, field = 'id') {
    return { [field]: sortBy === 'Oldest' ? 'ASC' : 'DESC' } as any;
}

export function growth(current: number, previous: number, startDate?: string, endDate?: string) {
    if (!startDate || !endDate) return 0;
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(2));
}
