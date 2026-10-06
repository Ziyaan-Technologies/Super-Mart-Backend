import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthActor } from 'src/common/auth-actor';
import { roundAmount } from 'src/common/decimal.transformer';
import { ElectricListDto } from 'src/common/electric.dto';
import { SUPPLIER_REASON, addCashMove, brief, sessionTotals } from 'src/common/electric-document';
import { ElectricAccessService } from 'src/electric-access/electric-access.service';
import { ElectricCashMove, ElectricCashMoveType } from 'src/electric-counter/models/electric-cash-move.entity';
import { ElectricSessionStatus } from 'src/electric-counter/models/electric-counter-session.entity';
import { ElectricPaymentMethod } from 'src/electric-sale/models/electric-sale.entity';
import { ElectricCreditor } from './models/electric-creditor.entity';
import { ElectricCreditorEntry, ElectricCreditorEntryType } from './models/electric-creditor-entry.entity';
import { ElectricCreditorPayment } from './models/electric-creditor-payment.entity';
import { ElectricCreditorIncentive } from './models/electric-creditor-incentive.entity';
import { ElectricCreditorDto, ElectricCreditorEntryDto, ElectricCreditorIncentiveDto, ElectricCreditorPaymentDto, ElectricCreditorUpdateDto } from './models/electric-creditor.dto';


@Injectable()
export class ElectricCreditorService {
    constructor(
        private access: ElectricAccessService,
        @InjectRepository(ElectricCreditor, 'MainConnection') private readonly creditorRepository: Repository<ElectricCreditor>,
        @InjectRepository(ElectricCreditorEntry, 'MainConnection') private readonly entryRepository: Repository<ElectricCreditorEntry>,
        @InjectRepository(ElectricCreditorPayment, 'MainConnection') private readonly paymentRepository: Repository<ElectricCreditorPayment>,
        @InjectRepository(ElectricCreditorIncentive, 'MainConnection') private readonly incentiveRepository: Repository<ElectricCreditorIncentive>,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
    ) { }

    private async balances(vendorId: number, ids: number[]) {
        const map = new Map<number, { taken: number; paid: number; entries: number; added_incentive: number; last_payment: Date | null }>();
        if (!ids.length) {
            return map;
        }
        const [taken, paid, incentives] = await Promise.all([
            this.creditorRepository.query(
                `SELECT creditor_id, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS entries
                 FROM electric_creditor_entries WHERE vendor_id = ? AND creditor_id IN (?) GROUP BY creditor_id`,
                [vendorId, ids],
            ),
            this.creditorRepository.query(
                `SELECT creditor_id, COALESCE(SUM(amount), 0) AS amount, MAX(created_at) AS last_payment
                 FROM electric_creditor_payments WHERE vendor_id = ? AND creditor_id IN (?) GROUP BY creditor_id`,
                [vendorId, ids],
            ),
            this.creditorRepository.query(
                `SELECT creditor_id, COALESCE(SUM(amount), 0) AS amount
                 FROM electric_creditor_incentives WHERE vendor_id = ? AND creditor_id IN (?) GROUP BY creditor_id`,
                [vendorId, ids],
            ),
        ]);
        ids.forEach((id) => {
            const takenRow = taken.find((row: any) => Number(row.creditor_id) === id);
            const paidRow = paid.find((row: any) => Number(row.creditor_id) === id);
            const incentiveRow = incentives.find((row: any) => Number(row.creditor_id) === id);
            map.set(id, {
                taken: roundAmount(parseFloat(takenRow?.amount || 0)),
                paid: roundAmount(parseFloat(paidRow?.amount || 0)),
                added_incentive: roundAmount(parseFloat(incentiveRow?.amount || 0)),
                entries: Number(takenRow?.entries || 0),
                last_payment: paidRow?.last_payment || null,
            });
        });
        return map;
    }

    private view(creditor: ElectricCreditor, totals?: { taken: number; paid: number; entries: number; added_incentive: number; last_payment: Date | null }) {
        const balance = roundAmount(creditor.opening_balance + (totals?.taken || 0) - (totals?.paid || 0));
        return {
            id: creditor.id,
            clientstore_id: creditor.clientstore_id,
            name: creditor.name,
            phone: creditor.phone,
            address: creditor.address,
            image_url: creditor.image_url,
            opening_balance: creditor.opening_balance,
            opening_incentive: creditor.incentive,
            incentive: roundAmount(creditor.incentive + (totals?.added_incentive || 0)),
            note: creditor.note,
            is_active: creditor.is_active,
            created_at: creditor.created_at,
            entries: totals?.entries || 0,
            taken: totals?.taken || 0,
            paid: totals?.paid || 0,
            last_payment: totals?.last_payment || null,
            balance,
            owed: Math.max(balance, 0),
            advance: Math.max(roundAmount(-balance), 0),
        };
    }

    private async own(actor: AuthActor, id: any) {
        const creditor = await this.creditorRepository.findOne({ where: { id: Number(id), vendor: { id: actor.vendor_id } } });
        if (!creditor) {
            throw new NotFoundException('Creditor not found');
        }
        await this.access.shop(actor, creditor.clientstore_id);
        return creditor;
    }

    async list(actor: AuthActor, body: ElectricListDto) {
        const shop = await this.access.shop(actor, body.clientstore_id);
        const query = this.creditorRepository.createQueryBuilder('creditor').where('creditor.clientstore_id = :shopId', { shopId: shop.id });
        if (body.search) {
            query.andWhere('(creditor.name LIKE :search OR creditor.phone LIKE :search)', { search: `%${body.search}%` });
        }
        if (body.status) {
            query.andWhere('creditor.is_active = :active', { active: body.status === 'Active' });
        }
        const rows = await query.orderBy('creditor.id', 'DESC').getMany();
        const totals = await this.balances(actor.vendor_id, rows.map((row) => row.id));
        let data = rows.map((row) => this.view(row, totals.get(row.id)));
        if (body.balance === 'We owe') {
            data = data.filter((row) => row.balance > 0);
        }
        if (body.balance === 'Clear') {
            data = data.filter((row) => row.balance === 0);
        }
        if (body.balance === 'Advance') {
            data = data.filter((row) => row.balance < 0);
        }
        const take = Number(body.take) || 10;
        const page = Number(body.page) || 1;
        return { data: data.slice((page - 1) * take, page * take), meta: { total: data.length, page, last_page: Math.ceil(data.length / take) } };
    }

    async kpis(actor: AuthActor, clientstoreId: any) {
        const shop = await this.access.shop(actor, clientstoreId);
        const rows = await this.creditorRepository.find({ where: { clientstore: { id: shop.id } } });
        const totals = await this.balances(actor.vendor_id, rows.map((row) => row.id));
        const views = rows.map((row) => this.view(row, totals.get(row.id)));
        return {
            creditors: views.length,
            owing: views.filter((row) => row.balance > 0).length,
            totalOwed: roundAmount(views.reduce((sum, row) => sum + row.owed, 0)),
            totalIncentive: roundAmount(views.reduce((sum, row) => sum + row.incentive, 0)),
        };
    }

    async dropdown(actor: AuthActor, clientstoreId: any, search: any) {
        const shop = await this.access.shop(actor, clientstoreId);
        const query = this.creditorRepository.createQueryBuilder('creditor')
            .where('creditor.clientstore_id = :shopId', { shopId: shop.id })
            .andWhere('creditor.is_active = 1');
        const term = String(search || '').trim();
        if (term) {
            query.andWhere('(creditor.name LIKE :search OR creditor.phone LIKE :search)', { search: `%${term}%` });
        }
        const rows = await query.orderBy('creditor.name', 'ASC').take(30).getMany();
        const totals = await this.balances(actor.vendor_id, rows.map((row) => row.id));
        return rows.map((row) => this.view(row, totals.get(row.id)));
    }

    async detail(actor: AuthActor, id: any) {
        const creditor = await this.own(actor, id);
        const totals = await this.balances(actor.vendor_id, [creditor.id]);
        const [entries, payments, incentives] = await Promise.all([
            this.entryRepository.find({
                where: { creditor: { id: creditor.id } },
                relations: ['clientstore', 'created_by_client'],
                order: { id: 'DESC' },
            }),
            this.paymentRepository.find({
                where: { creditor: { id: creditor.id } },
                relations: ['clientstore', 'counter', 'paid_by_client'],
                order: { id: 'DESC' },
            }),
            this.incentiveRepository.find({
                where: { creditor: { id: creditor.id } },
                relations: ['clientstore', 'created_by_client'],
                order: { id: 'DESC' },
            }),
        ]);
        return {
            ...this.view(creditor, totals.get(creditor.id)),
            entry_rows: entries.map((entry) => ({
                id: entry.id,
                type: entry.type,
                amount: entry.amount,
                note: entry.note,
                shop: entry.clientstore?.store_name,
                added_by: brief(entry.created_by_client),
                created_at: entry.created_at,
            })),
            incentives: incentives.map((incentive) => ({
                id: incentive.id,
                amount: incentive.amount,
                note: incentive.note,
                shop: incentive.clientstore?.store_name,
                added_by: brief(incentive.created_by_client),
                created_at: incentive.created_at,
            })),
            payments: payments.map((payment) => ({
                id: payment.id,
                amount: payment.amount,
                method: payment.method,
                note: payment.note,
                shop: payment.clientstore?.store_name,
                counter: payment.counter?.name,
                paid_by: brief(payment.paid_by_client),
                created_at: payment.created_at,
            })),
        };
    }

    async create(actor: AuthActor, body: ElectricCreditorDto) {
        const shop = await this.access.shop(actor, body.clientstore_id);
        const saved = await this.creditorRepository.save({
            vendor: { id: actor.vendor_id },
            clientstore: { id: shop.id },
            name: body.name.trim(),
            phone: body.phone?.trim() || null,
            address: body.address?.trim() || null,
            image_url: body.image_url?.trim() || null,
            opening_balance: roundAmount(Number(body.opening_balance) || 0),
            incentive: roundAmount(Number(body.incentive) || 0),
            note: body.note?.trim() || null,
            is_active: body.is_active ?? true,
        });
        return this.view(saved);
    }

    async update(actor: AuthActor, id: any, body: ElectricCreditorUpdateDto) {
        const creditor = await this.own(actor, id);
        await this.creditorRepository.update(creditor.id, {
            name: body.name?.trim() ?? creditor.name,
            phone: body.phone?.trim() ?? creditor.phone,
            address: body.address?.trim() ?? creditor.address,
            image_url: body.image_url === undefined ? creditor.image_url : (body.image_url?.trim() || null),
            opening_balance: body.opening_balance === undefined ? creditor.opening_balance : roundAmount(Number(body.opening_balance) || 0),
            incentive: body.incentive === undefined ? creditor.incentive : roundAmount(Number(body.incentive) || 0),
            note: body.note?.trim() ?? creditor.note,
            is_active: body.is_active ?? creditor.is_active,
        });
        return this.detail(actor, creditor.id);
    }

    async remove(actor: AuthActor, id: any) {
        const creditor = await this.own(actor, id);
        const [entries, payments] = await Promise.all([
            this.entryRepository.count({ where: { creditor: { id: creditor.id } } }),
            this.paymentRepository.count({ where: { creditor: { id: creditor.id } } }),
        ]);
        if (entries || payments) {
            throw new BadRequestException('This creditor has khata entries or payments and cannot be deleted');
        }
        await this.creditorRepository.delete(creditor.id);
        return { message: 'Creditor deleted' };
    }

    async addEntry(actor: AuthActor, id: any, body: ElectricCreditorEntryDto) {
        const creditor = await this.own(actor, id);
        const amount = roundAmount(Number(body.amount) || 0);
        if (amount <= 0) {
            throw new BadRequestException('Enter what we owe him');
        }
        const shop = body.clientstore_id ? await this.access.shop(actor, body.clientstore_id) : null;
        await this.entryRepository.save({
            creditor: { id: creditor.id },
            vendor: { id: actor.vendor_id },
            clientstore: shop ? { id: shop.id } : null,
            type: ElectricCreditorEntryType.MANUAL,
            amount,
            note: body.note.trim(),
            created_by_client: { id: actor.id },
        });
        return this.detail(actor, creditor.id);
    }

    /** incentive he promises for hitting a target — money on paper, so it touches nothing else */
    async addIncentive(actor: AuthActor, id: any, body: ElectricCreditorIncentiveDto) {
        const creditor = await this.own(actor, id);
        const amount = roundAmount(Number(body.amount) || 0);
        if (amount <= 0) {
            throw new BadRequestException('Enter the incentive amount');
        }
        const shop = body.clientstore_id ? await this.access.shop(actor, body.clientstore_id) : null;
        await this.incentiveRepository.save({
            creditor: { id: creditor.id },
            vendor: { id: actor.vendor_id },
            clientstore: shop ? { id: shop.id } : null,
            amount,
            note: body.note?.trim() || null,
            created_by_client: { id: actor.id },
        });
        return this.detail(actor, creditor.id);
    }

    async addPayment(actor: AuthActor, id: any, body: ElectricCreditorPaymentDto) {
        const creditor = await this.own(actor, id);
        const amount = roundAmount(Number(body.amount) || 0);
        if (amount <= 0) {
            throw new BadRequestException('Enter the amount being paid');
        }
        const method = Object.values(ElectricPaymentMethod).includes(body.method as ElectricPaymentMethod)
            ? (body.method as ElectricPaymentMethod)
            : ElectricPaymentMethod.CASH;
        const session = method === ElectricPaymentMethod.CASH
            ? await this.access.cashSession(actor, Number(body.clientstore_id) || 0, body.session_id)
            : null;
        const note = body.note?.trim() || null;
        await this.dataSource.transaction(async (manager) => {
            // cash out of a counter writes the khata payment itself, so it is saved once
            if (session) {
                await addCashMove(manager, actor.id, session, {
                    type: ElectricCashMoveType.OUT,
                    reason: SUPPLIER_REASON,
                    amount,
                    note,
                    creditor_id: creditor.id,
                });
                return;
            }
            await manager.save(ElectricCreditorPayment, {
                creditor: { id: creditor.id },
                vendor: { id: actor.vendor_id },
                clientstore: body.clientstore_id ? { id: Number(body.clientstore_id) } : null,
                counter: null,
                session: null,
                amount,
                method,
                note,
                paid_by_client: { id: actor.id },
            });
        });
        return this.detail(actor, creditor.id);
    }

    /** a payment can only be changed while the counter it came out of is still open */
    private async editablePayment(creditorId: number, paymentId: any) {
        const payment = await this.paymentRepository.findOne({
            where: { id: Number(paymentId), creditor: { id: creditorId } },
            relations: ['session'],
        });
        if (!payment) {
            throw new NotFoundException('Payment not found');
        }
        if (payment.session && payment.session.status !== ElectricSessionStatus.OPEN) {
            throw new BadRequestException('This payment came out of a counter that is already closed, so it cannot be changed');
        }
        return payment;
    }

    async updatePayment(actor: AuthActor, id: any, paymentId: any, body: ElectricCreditorPaymentDto) {
        const creditor = await this.own(actor, id);
        const payment = await this.editablePayment(creditor.id, paymentId);
        const amount = roundAmount(Number(body.amount) || 0);
        if (amount <= 0) {
            throw new BadRequestException('Enter the amount being paid');
        }
        const note = body.note === undefined ? payment.note : (body.note?.trim() || null);
        await this.dataSource.transaction(async (manager) => {
            if (payment.cash_move_id) {
                const extra = roundAmount(amount - payment.amount);
                if (extra > 0) {
                    const totals = await sessionTotals(manager, payment.session);
                    if (extra > totals.cash_now) {
                        throw new BadRequestException('There is not that much cash left in the counter');
                    }
                }
                await manager.update(ElectricCashMove, payment.cash_move_id, {
                    amount,
                    note: [creditor.name, note].filter(Boolean).join(' · ') || null,
                });
            }
            await manager.update(ElectricCreditorPayment, payment.id, { amount, note });
        });
        return this.detail(actor, creditor.id);
    }

    async removePayment(actor: AuthActor, id: any, paymentId: any) {
        const creditor = await this.own(actor, id);
        const payment = await this.editablePayment(creditor.id, paymentId);
        await this.dataSource.transaction(async (manager) => {
            await manager.delete(ElectricCreditorPayment, payment.id);
            if (payment.cash_move_id) {
                await manager.delete(ElectricCashMove, payment.cash_move_id);
            }
        });
        return this.detail(actor, creditor.id);
    }
}
