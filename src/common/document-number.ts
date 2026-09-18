import * as moment from 'moment-timezone';

export function documentNumber(prefix: string, id: number) {
    return `${prefix}-${moment().format('YYMM')}-${String(id).padStart(5, '0')}`;
}
