import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import * as moment from 'moment-timezone';
import { AuthActor } from 'src/common/auth-actor';
import { roundAmount } from 'src/common/decimal.transformer';
import { ElectricAccessService } from 'src/electric-access/electric-access.service';
import { addCashMove, brief, closeSession, dayKey, openSession, sessionTotals } from 'src/common/electric-document';
import { ElectricCounter } from './models/electric-counter.entity';
import { ElectricCounterSession, ElectricSessionStatus } from './models/electric-counter-session.entity';
import { ElectricCashMove } from './models/electric-cash-move.entity';
import { ElectricSale } from 'src/electric-sale/models/electric-sale.entity';
import { ElectricSaleReturn } from 'src/electric-sale/models/electric-sale-return.entity';
import { ElectricListDto } from 'src/common/electric.dto';
import { ElectricCounterDto } from './models/electric-counter.dto';

@Injectable()
export class ElectricCounterService {
    constructor(
        private access: ElectricAccessService,
        @InjectRepository(ElectricCounter, 'MainConnection') private readonly counterRepository: Repository<ElectricCounter>,
        @InjectRepository(ElectricCounterSession, 'MainConnection') private readonly sessionRepository: Repository<ElectricCounterSession>,
        @InjectRepository(ElectricCashMove, 'MainConnection') private readonly moveRepository: Repository<ElectricCashMove>,
        @InjectRepository(ElectricSale, 'MainConnection') private readonly saleRepository: Repository<ElectricSale>,
        @InjectRepository(ElectricSaleReturn, 'MainConnection') private readonly returnRepository: Repository<ElectricSaleReturn>,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
    ) { }

    async sessionView(session: ElectricCounterSession | null) {
        if (!session) return null;
        const full = await this.sessionRepository.findOne({ where: { id: session.id }, relations: ['counter', 'cashier'] });
        const { counter, cashier, vendor, clientstore, ...rest } = full as any;
        return { ...rest, counter, cashier: brief(cashier), totals: await sessionTotals(this.dataSource.manager, full) };
    }

    async counterView(counter: ElectricCounter) {
        const today = moment().startOf('day').toDate();
        const [session, last, sessionCount, [todayRow]] = await Promise.all([
            this.sessionRepository.findOne({ where: { counter: { id: counter.id }, status: ElectricSessionStatus.OPEN } }),
            this.sessionRepository.findOne({ where: { counter: { id: counter.id }, status: ElectricSessionStatus.CLOSED }, relations: ['cashier'], order: { closed_at: 'DESC' } }),
            this.sessionRepository.count({ where: { counter: { id: counter.id } } }),
            this.dataSource.query('SELECT COUNT(*) AS bills, COALESCE(SUM(total_amount), 0) AS sales FROM electric_sales WHERE counter_id = ? AND created_at >= ?', [counter.id, today]),
        ]);
        return {
            ...counter,
            status: session ? 'Open' : 'Closed',
            session: await this.sessionView(session),
            last_session: last ? { id: last.id, closed_at: last.closed_at, closing_cash: last.closing_cash, cash_difference: last.cash_difference, cashier: brief(last.cashier) } : null,
            today: { bills: Number(todayRow.bills), sales: roundAmount(parseFloat(todayRow.sales)) },
            session_count: sessionCount,
        };
    }

    async counterViews(shopId: number, activeOnly = true, search = '') {
        const query = this.counterRepository.createQueryBuilder('counter').where('counter.clientstore_id = :shopId', { shopId }).orderBy('counter.name', 'ASC');
        if (activeOnly) query.andWhere('counter.is_active = 1');
        if (search) query.andWhere('(counter.name LIKE :search OR counter.description LIKE :search)', { search: `%${search}%` });
        const counters = await query.getMany();
        return Promise.all(counters.map((counter) => this.counterView(counter)));
    }

    async list(actor: AuthActor, body: ElectricListDto) {
        const shop = await this.access.shop(actor, body.clientstore_id);
        const rows = (await this.counterViews(shop.id, false, body.search)).sort((a, b) => b.id - a.id);
        const take = Number(body.take) || 10;
        const page = Number(body.page) || 1;
        return { data: rows.slice((page - 1) * take, page * take), meta: { total: rows.length, page, last_page: Math.ceil(rows.length / take) } };
    }

    async dropdown(actor: AuthActor, clientstoreId: any) {
        const shop = await this.access.shop(actor, clientstoreId);
        return this.counterViews(shop.id);
    }

    async mine(actor: AuthActor, clientstoreId: any) {
        await this.access.shop(actor, clientstoreId);
        const own = await this.access.ownCounterId(actor);
        if (own === null) return { all: true, counter: null };
        const counter = await this.counterRepository.findOne({ where: { id: own } });
        return { all: false, counter: counter ? { id: counter.id, name: counter.name } : null };
    }

    private async assertUniqueName(shopId: number, name: string, exceptId?: number) {
        const clean = String(name || '').trim();
        if (!clean) throw new BadRequestException('Name is required');
        const where: any = { clientstore: { id: shopId }, name: clean };
        if (exceptId) where.id = Not(exceptId);
        if (await this.counterRepository.findOne({ where })) throw new BadRequestException(`"${clean}" already exists`);
        return clean;
    }

    async create(actor: AuthActor, body: ElectricCounterDto) {
        const shop = await this.access.shop(actor, body.clientstore_id);
        const saved = await this.counterRepository.save({
            vendor: { id: actor.vendor_id },
            clientstore: { id: shop.id },
            name: await this.assertUniqueName(shop.id, body.name),
            description: body.description || '',
            drawer_cash: roundAmount(Number(body.drawer_cash) || 0),
            is_active: body.is_active !== false,
        });
        return this.counterRepository.findOne({ where: { id: saved.id } });
    }

    async counter(actor: AuthActor, id: number) {
        const counter = await this.counterRepository.findOne({ where: { id } });
        if (!counter) throw new NotFoundException('Counter not found');
        await this.access.shop(actor, counter.clientstore_id);
        return counter;
    }

    private isOpen(counterId: number) {
        return this.sessionRepository.findOne({ where: { counter: { id: counterId }, status: ElectricSessionStatus.OPEN } });
    }

    async update(actor: AuthActor, id: number, body: Partial<ElectricCounterDto>) {
        const counter = await this.counter(actor, id);
        if (body.is_active === false && (await this.isOpen(counter.id))) {
            throw new BadRequestException('Close this counter before making it inactive');
        }
        await this.counterRepository.update(counter.id, {
            name: await this.assertUniqueName(counter.clientstore_id, body.name ?? counter.name, counter.id),
            description: body.description ?? counter.description,
            is_active: body.is_active ?? counter.is_active,
        });
        return this.counterRepository.findOne({ where: { id: counter.id } });
    }

    async remove(actor: AuthActor, id: number) {
        const counter = await this.counter(actor, id);
        if (await this.isOpen(counter.id)) {
            throw new BadRequestException('Close this counter before deleting it');
        }
        if (await this.sessionRepository.count({ where: { counter: { id: counter.id } } })) {
            await this.counterRepository.update(counter.id, { is_active: false });
            return { deactivated: true, message: 'This counter has old sessions, so it was made inactive instead of deleted.' };
        }
        await this.counterRepository.softDelete(counter.id);
        return { message: 'Counter deleted' };
    }

    async current(actor: AuthActor, clientstoreId: any) {
        const shop = await this.access.shop(actor, clientstoreId);
        const session = await this.access.mySession(actor.id);
        if (!session) return null;
        if (session.clientstore_id !== shop.id) {
            const full = await this.sessionRepository.findOne({ where: { id: session.id }, relations: ['counter', 'clientstore'] });
            return { elsewhere: true, shop: full.clientstore?.store_name, counter: full.counter?.name };
        }
        return this.sessionView(session);
    }

    async open(actor: AuthActor, body: { counter_id: number; opening_cash: number }) {
        await this.access.need(actor, 'counters_open_close', 'You cannot open a counter');
        await this.counter(actor, Number(body.counter_id));
        const record = await this.access.record(actor);
        const session = await this.dataSource.transaction((manager) => openSession(manager, record, Number(body.counter_id), Number(body.opening_cash)));
        return this.sessionView(session);
    }

    async session(actor: AuthActor, id: number) {
        const session = await this.sessionRepository.findOne({ where: { id } });
        if (!session) throw new NotFoundException('Counter session not found');
        await this.access.shop(actor, session.clientstore_id);
        return session;
    }

    async cashMoves(sessionId: number) {
        const moves = await this.moveRepository.find({ where: { session: { id: sessionId } }, relations: ['created_by_client'], order: { created_at: 'ASC' } });
        return moves.map(({ created_by_client, ...move }) => ({ ...move, by: brief(created_by_client) }));
    }

    async addMove(actor: AuthActor, id: number, body: any) {
        const session = await this.session(actor, id);
        await this.access.need(actor, body.type === 'In' ? 'counters_cash_in' : 'counters_cash_out');
        await this.dataSource.transaction((manager) => addCashMove(manager, actor.id, session, body));
        return this.sessionView(session);
    }

    async close(actor: AuthActor, id: number, body: any) {
        const session = await this.session(actor, id);
        await this.access.need(actor, 'counters_open_close', 'You cannot close a counter');
        const closed = await this.dataSource.transaction((manager) => closeSession(manager, session, body));
        return this.sessionView(closed);
    }

    async cashFlow(actor: AuthActor, id: number, date?: string) {
        const counter = await this.counter(actor, id);
        const day = date || dayKey();
        const start = moment(day).startOf('day').toDate();
        const end = moment(day).endOf('day').toDate();
        const sessions = await this.sessionRepository.createQueryBuilder('session')
            .where('session.counter_id = :counterId', { counterId: counter.id })
            .andWhere('(session.opened_at BETWEEN :start AND :end OR session.closed_at BETWEEN :start AND :end OR (session.status = :open AND session.opened_at <= :end))', { start, end, open: ElectricSessionStatus.OPEN })
            .orderBy('session.opened_at', 'ASC')
            .getMany();
        const views = [];
        for (const session of sessions) {
            const view: any = await this.sessionView(session);
            const entries: any[] = [{ time: session.opened_at, type: 'Opening', label: 'Opening cash', amount: session.opening_cash, in_drawer: true, by: view.cashier }];
            const [sales, returns, moves] = await Promise.all([
                this.saleRepository.find({ where: { session: { id: session.id } }, relations: ['cashier'] }),
                this.returnRepository.find({ where: { session: { id: session.id } }, relations: ['processed_by_client', 'sale'] }),
                this.moveRepository.find({ where: { session: { id: session.id } }, relations: ['created_by_client'] }),
            ]);
            sales.forEach((sale) => entries.push({
                time: sale.created_at,
                type: 'Sale',
                label: `Bill ${sale.bill_number}${sale.customer_name ? ` · ${sale.customer_name}` : ''}`,
                amount: sale.total_amount,
                method: sale.payment_method,
                in_drawer: sale.payment_method === 'Cash',
                sale_id: sale.id,
                by: brief(sale.cashier),
            }));
            returns.forEach((row) => entries.push({
                time: row.created_at,
                type: 'Refund',
                label: `Return ${row.return_number} of bill ${row.sale?.bill_number} · ${row.reason}`,
                amount: -row.refund_amount,
                method: row.refund_method,
                in_drawer: row.refund_method === 'Cash',
                sale_id: row.sale_id,
                by: brief(row.processed_by_client),
            }));
            moves.forEach((move) => entries.push({
                time: move.created_at,
                type: move.type === 'In' ? 'Cash In' : 'Cash Out',
                label: move.reason + (move.note ? ` · ${move.note}` : ''),
                amount: move.type === 'In' ? move.amount : -move.amount,
                in_drawer: true,
                by: brief(move.created_by_client),
            }));
            entries.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime() || (a.type === 'Opening' ? -1 : 1));
            let balance = 0;
            entries.forEach((entry) => {
                if (entry.in_drawer) balance = roundAmount(balance + entry.amount);
                entry.balance = balance;
            });
            if (session.status === ElectricSessionStatus.CLOSED) {
                entries.push({ time: session.closed_at, type: 'Closing', label: 'Cash counted at close', amount: session.closing_cash, in_drawer: false, balance: session.closing_cash, by: view.cashier });
            }
            views.push({ ...view, entries });
        }
        const sum = (key: string) => roundAmount(views.reduce((total, session) => total + session.totals[key], 0));
        const closed = views.filter((session) => session.status === ElectricSessionStatus.CLOSED);
        return {
            counter,
            date: day,
            sessions: views,
            summary: {
                opening: roundAmount(views.reduce((total, session) => total + session.opening_cash, 0)),
                cash_sales: sum('cash_sales'),
                card_sales: sum('card_sales'),
                online_sales: sum('online_sales'),
                cash_in: sum('cash_in'),
                cash_out: sum('cash_out'),
                cash_refunds: sum('cash_refunds'),
                refunds_total: sum('refunds_total'),
                expected: sum('cash_now'),
                counted: closed.length ? roundAmount(closed.reduce((total, session) => total + session.closing_cash, 0)) : null,
                difference: closed.length ? roundAmount(closed.reduce((total, session) => total + session.cash_difference, 0)) : null,
                bills: sum('bills'),
            },
        };
    }
}
