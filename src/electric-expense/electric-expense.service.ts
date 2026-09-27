import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as moment from 'moment-timezone';
import { AuthActor } from 'src/common/auth-actor';
import { roundAmount } from 'src/common/decimal.transformer';
import { ElectricListDto } from 'src/common/electric.dto';
import { brief, dayKey } from 'src/common/electric-document';
import { ElectricAccessService } from 'src/electric-access/electric-access.service';
import { ElectricCashMove, ElectricCashMoveType } from 'src/electric-counter/models/electric-cash-move.entity';

export const EXPENSE_REASON = 'Shop expense';

@Injectable()
export class ElectricExpenseService {
    constructor(
        private access: ElectricAccessService,
        @InjectRepository(ElectricCashMove, 'MainConnection') private readonly moveRepository: Repository<ElectricCashMove>,
    ) { }

    private query(shopId: number, body: ElectricListDto) {
        const query = this.moveRepository.createQueryBuilder('move')
            .leftJoinAndSelect('move.counter', 'counter')
            .leftJoinAndSelect('move.created_by_client', 'client')
            .where('move.clientstore_id = :shopId', { shopId })
            .andWhere('move.type = :type', { type: ElectricCashMoveType.OUT })
            .andWhere('move.reason = :reason', { reason: EXPENSE_REASON });
        if (body.counter_id) {
            query.andWhere('move.counter_id = :counterId', { counterId: Number(body.counter_id) });
        }
        if (body.startDate) {
            query.andWhere('move.created_at >= :start', { start: moment(body.startDate).startOf('day').toDate() });
        }
        if (body.endDate || body.startDate) {
            query.andWhere('move.created_at <= :end', { end: moment(body.endDate || body.startDate).endOf('day').toDate() });
        }
        if (body.search) {
            query.andWhere('move.note LIKE :search', { search: `%${body.search}%` });
        }
        return query.orderBy('move.created_at', 'DESC');
    }

    /** one row per day, newest first */
    async listDays(actor: AuthActor, body: ElectricListDto) {
        const shop = await this.access.shop(actor, body.clientstore_id);
        const moves = await this.query(shop.id, body).getMany();
        const days = new Map<string, any>();
        moves.forEach((move) => {
            const key = dayKey(move.created_at);
            if (!days.has(key)) {
                days.set(key, { date: key, entries: 0, total: 0, counters: new Set<string>() });
            }
            const day = days.get(key);
            day.entries += 1;
            day.total = roundAmount(day.total + move.amount);
            if (move.counter?.name) day.counters.add(move.counter.name);
        });
        const rows = Array.from(days.values()).map((day) => ({ ...day, counters: Array.from(day.counters) }));
        const take = Number(body.take) || 10;
        const page = Number(body.page) || 1;
        return { data: rows.slice((page - 1) * take, page * take), meta: { total: rows.length, page, last_page: Math.ceil(rows.length / take) } };
    }

    async kpis(actor: AuthActor, body: ElectricListDto) {
        const shop = await this.access.shop(actor, body.clientstore_id);
        const moves = await this.moveRepository.find({
            where: { clientstore: { id: shop.id }, type: ElectricCashMoveType.OUT, reason: EXPENSE_REASON },
        });
        const sum = (rows: ElectricCashMove[]) => roundAmount(rows.reduce((total, row) => total + row.amount, 0));
        const today = moves.filter((move) => dayKey(move.created_at) === dayKey());
        const month = moves.filter((move) => moment(move.created_at).isSame(moment(), 'month'));
        return {
            today: sum(today),
            todayCount: today.length,
            month: sum(month),
            monthCount: month.length,
        };
    }

    /** everything spent on one day, plus the other cash that left the counters */
    async day(actor: AuthActor, clientstoreId: any, date: string) {
        const shop = await this.access.shop(actor, clientstoreId);
        const day = date || dayKey();
        const start = moment(day).startOf('day').toDate();
        const end = moment(day).endOf('day').toDate();
        const moves = await this.moveRepository.createQueryBuilder('move')
            .leftJoinAndSelect('move.counter', 'counter')
            .leftJoinAndSelect('move.created_by_client', 'client')
            .where('move.clientstore_id = :shopId', { shopId: shop.id })
            .andWhere('move.type = :type', { type: ElectricCashMoveType.OUT })
            .andWhere('move.created_at BETWEEN :start AND :end', { start, end })
            .orderBy('move.created_at', 'ASC')
            .getMany();
        const view = (move: ElectricCashMove) => ({
            id: move.id,
            time: move.created_at,
            reason: move.reason,
            note: move.note,
            amount: move.amount,
            counter: move.counter ? { id: move.counter.id, name: move.counter.name } : null,
            by: brief(move.created_by_client),
        });
        const expenses = moves.filter((move) => move.reason === EXPENSE_REASON);
        const others = moves.filter((move) => move.reason !== EXPENSE_REASON);
        return {
            date: day,
            expenses: expenses.map(view),
            total: roundAmount(expenses.reduce((sum, move) => sum + move.amount, 0)),
            other_cash_out: others.map(view),
            other_total: roundAmount(others.reduce((sum, move) => sum + move.amount, 0)),
        };
    }
}
