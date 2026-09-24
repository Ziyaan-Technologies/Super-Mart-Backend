import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthActor } from 'src/common/auth-actor';
import { roundAmount } from 'src/common/decimal.transformer';
import { ElectricListDto } from 'src/common/electric.dto';
import { brief } from 'src/common/electric-document';
import { ElectricAccessService } from 'src/electric-access/electric-access.service';
import { ElectricSessionStatus } from 'src/electric-counter/models/electric-counter-session.entity';
import { ElectricPaymentMethod, ElectricSale } from 'src/electric-sale/models/electric-sale.entity';
import { ElectricDebtor } from './models/electric-debtor.entity';
import { ElectricDebtorPayment } from './models/electric-debtor-payment.entity';
import { ElectricDebtorDto, ElectricDebtorPaymentDto, ElectricDebtorUpdateDto } from './models/electric-debtor.dto';

@Injectable()
export class ElectricDebtorService {
    constructor(
        private access: ElectricAccessService,
        @InjectRepository(ElectricDebtor, 'MainConnection') private readonly debtorRepository: Repository<ElectricDebtor>,
        @InjectRepository(ElectricDebtorPayment, 'MainConnection') private readonly paymentRepository: Repository<ElectricDebtorPayment>,
        @InjectRepository(ElectricSale, 'MainConnection') private readonly saleRepository: Repository<ElectricSale>,
    ) { }

    private async balances(vendorId: number, ids: number[]) {
        const map = new Map<number, { billed: number; paid: number; bills: number; last_payment: Date | null }>();
        if (!ids.length) {
            return map;
        }
        const [billed, paid] = await Promise.all([
            this.debtorRepository.query(
                `SELECT debtor_id, COALESCE(SUM(khata_amount), 0) AS amount, COUNT(*) AS bills
                 FROM electric_sales WHERE vendor_id = ? AND debtor_id IN (?) GROUP BY debtor_id`,
                [vendorId, ids],
            ),
            this.debtorRepository.query(
                `SELECT debtor_id, COALESCE(SUM(amount), 0) AS amount, MAX(created_at) AS last_payment
                 FROM electric_debtor_payments WHERE vendor_id = ? AND debtor_id IN (?) GROUP BY debtor_id`,
                [vendorId, ids],
            ),
        ]);
        ids.forEach((id) => {
            const billedRow = billed.find((row: any) => Number(row.debtor_id) === id);
            const paidRow = paid.find((row: any) => Number(row.debtor_id) === id);
            map.set(id, {
                billed: roundAmount(parseFloat(billedRow?.amount || 0)),
                paid: roundAmount(parseFloat(paidRow?.amount || 0)),
                bills: Number(billedRow?.bills || 0),
                last_payment: paidRow?.last_payment || null,
            });
        });
        return map;
    }

    private view(debtor: ElectricDebtor, totals?: { billed: number; paid: number; bills: number; last_payment: Date | null }) {
        return {
            id: debtor.id,
            name: debtor.name,
            phone: debtor.phone,
            address: debtor.address,
            opening_balance: debtor.opening_balance,
            note: debtor.note,
            is_active: debtor.is_active,
            created_at: debtor.created_at,
            bills: totals?.bills || 0,
            billed: totals?.billed || 0,
            paid: totals?.paid || 0,
            last_payment: totals?.last_payment || null,
            balance: roundAmount(debtor.opening_balance + (totals?.billed || 0) - (totals?.paid || 0)),
        };
    }

    private async own(actor: AuthActor, id: any) {
        const debtor = await this.debtorRepository.findOne({ where: { id: Number(id), vendor: { id: actor.vendor_id } } });
        if (!debtor) {
            throw new NotFoundException('Debtor not found');
        }
        return debtor;
    }

    async list(actor: AuthActor, body: ElectricListDto) {
        const query = this.debtorRepository.createQueryBuilder('debtor').where('debtor.vendor_id = :vendorId', { vendorId: actor.vendor_id });
        if (body.search) {
            query.andWhere('(debtor.name LIKE :search OR debtor.phone LIKE :search)', { search: `%${body.search}%` });
        }
        if (body.status) {
            query.andWhere('debtor.is_active = :active', { active: body.status === 'Active' });
        }
        const rows = await query.orderBy('debtor.id', 'DESC').getMany();
        const totals = await this.balances(actor.vendor_id, rows.map((row) => row.id));
        let data = rows.map((row) => this.view(row, totals.get(row.id)));
        if (body.balance === 'Owing') {
            data = data.filter((row) => row.balance > 0);
        }
        if (body.balance === 'Clear') {
            data = data.filter((row) => row.balance <= 0);
        }
        const take = Number(body.take) || 10;
        const page = Number(body.page) || 1;
        return { data: data.slice((page - 1) * take, page * take), meta: { total: data.length, page, last_page: Math.ceil(data.length / take) } };
    }

    async kpis(actor: AuthActor) {
        const rows = await this.debtorRepository.find({ where: { vendor: { id: actor.vendor_id } } });
        const totals = await this.balances(actor.vendor_id, rows.map((row) => row.id));
        const views = rows.map((row) => this.view(row, totals.get(row.id)));
        return {
            debtors: views.length,
            owing: views.filter((row) => row.balance > 0).length,
            totalOwed: roundAmount(views.reduce((sum, row) => sum + Math.max(row.balance, 0), 0)),
            totalPaid: roundAmount(views.reduce((sum, row) => sum + row.paid, 0)),
        };
    }

    async dropdown(actor: AuthActor, search: any) {
        const query = this.debtorRepository.createQueryBuilder('debtor')
            .where('debtor.vendor_id = :vendorId', { vendorId: actor.vendor_id })
            .andWhere('debtor.is_active = 1');
        const term = String(search || '').trim();
        if (term) {
            query.andWhere('(debtor.name LIKE :search OR debtor.phone LIKE :search)', { search: `%${term}%` });
        }
        const rows = await query.orderBy('debtor.name', 'ASC').take(30).getMany();
        const totals = await this.balances(actor.vendor_id, rows.map((row) => row.id));
        return rows.map((row) => this.view(row, totals.get(row.id)));
    }

    async detail(actor: AuthActor, id: any) {
        const debtor = await this.own(actor, id);
        const totals = await this.balances(actor.vendor_id, [debtor.id]);
        const [bills, payments] = await Promise.all([
            this.saleRepository.find({
                where: { debtor_id: debtor.id },
                relations: ['clientstore', 'counter', 'cashier'],
                order: { id: 'DESC' },
            }),
            this.paymentRepository.find({
                where: { debtor: { id: debtor.id } },
                relations: ['clientstore', 'counter', 'received_by_client'],
                order: { id: 'DESC' },
            }),
        ]);
        const view = this.view(debtor, totals.get(debtor.id));
        return {
            ...view,
            bill_count: view.bills,
            bills: bills.map((sale) => ({
                id: sale.id,
                bill_number: sale.bill_number,
                created_at: sale.created_at,
                shop: sale.clientstore?.store_name,
                counter: sale.counter?.name,
                cashier: brief(sale.cashier),
                total_amount: sale.total_amount,
                paid_amount: sale.paid_amount,
                khata_amount: sale.khata_amount,
                refunded_amount: sale.refunded_amount,
                status: sale.status,
            })),
            payments: payments.map((payment) => ({
                id: payment.id,
                amount: payment.amount,
                method: payment.method,
                note: payment.note,
                shop: payment.clientstore?.store_name,
                counter: payment.counter?.name,
                received_by: brief(payment.received_by_client),
                created_at: payment.created_at,
            })),
        };
    }

    async create(actor: AuthActor, body: ElectricDebtorDto) {
        const saved = await this.debtorRepository.save({
            vendor: { id: actor.vendor_id },
            name: body.name.trim(),
            phone: body.phone?.trim() || null,
            address: body.address?.trim() || null,
            opening_balance: roundAmount(Number(body.opening_balance) || 0),
            note: body.note?.trim() || null,
            is_active: body.is_active ?? true,
        });
        return this.view(saved);
    }

    async update(actor: AuthActor, id: any, body: ElectricDebtorUpdateDto) {
        const debtor = await this.own(actor, id);
        await this.debtorRepository.update(debtor.id, {
            name: body.name?.trim() ?? debtor.name,
            phone: body.phone?.trim() ?? debtor.phone,
            address: body.address?.trim() ?? debtor.address,
            opening_balance: body.opening_balance === undefined ? debtor.opening_balance : roundAmount(Number(body.opening_balance) || 0),
            note: body.note?.trim() ?? debtor.note,
            is_active: body.is_active ?? debtor.is_active,
        });
        return this.detail(actor, debtor.id);
    }

    async remove(actor: AuthActor, id: any) {
        const debtor = await this.own(actor, id);
        const [bills, payments] = await Promise.all([
            this.saleRepository.count({ where: { debtor_id: debtor.id } }),
            this.paymentRepository.count({ where: { debtor: { id: debtor.id } } }),
        ]);
        if (bills || payments) {
            throw new BadRequestException('This debtor has bills or payments and cannot be deleted');
        }
        await this.debtorRepository.delete(debtor.id);
        return { message: 'Debtor deleted' };
    }

    async addPayment(actor: AuthActor, id: any, body: ElectricDebtorPaymentDto) {
        const debtor = await this.own(actor, id);
        const amount = roundAmount(Number(body.amount) || 0);
        if (amount <= 0) {
            throw new BadRequestException('Enter the amount being paid');
        }
        const totals = await this.balances(actor.vendor_id, [debtor.id]);
        const balance = this.view(debtor, totals.get(debtor.id)).balance;
        if (amount > balance) {
            throw new BadRequestException(`This debtor only owes ${balance}`);
        }
        const session = await this.access.mySession(actor.id);
        if (!session || session.status !== ElectricSessionStatus.OPEN) {
            throw new BadRequestException('Open your counter before taking a payment');
        }
        const method = Object.values(ElectricPaymentMethod).includes(body.method as ElectricPaymentMethod)
            ? (body.method as ElectricPaymentMethod)
            : ElectricPaymentMethod.CASH;
        await this.paymentRepository.save({
            debtor: { id: debtor.id },
            vendor: { id: actor.vendor_id },
            clientstore: { id: session.clientstore_id },
            counter: { id: session.counter_id },
            session: { id: session.id },
            amount,
            method,
            note: body.note?.trim() || null,
            received_by_client: { id: actor.id },
        });
        return this.detail(actor, debtor.id);
    }
}
