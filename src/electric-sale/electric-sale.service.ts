import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import * as moment from 'moment-timezone';
import { AuthActor } from 'src/common/auth-actor';
import { paginateQuery } from 'src/common/document-list';
import { roundAmount } from 'src/common/decimal.transformer';
import { ElectricListDto } from 'src/common/electric.dto';
import { brief, createSale, dayKey, isPending, payBill, paymentState, returnSale, saleProfit, setItemCost, shopView, vendorView } from 'src/common/electric-document';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { ElectricAccessService } from 'src/electric-access/electric-access.service';
import { ElectricQuotationService } from 'src/electric-quotation/electric-quotation.service';
import { ElectricProductVariant } from 'src/electric-product/models/electric-product-variant.entity';
import { ElectricSale } from './models/electric-sale.entity';
import { ElectricSaleItem } from './models/electric-sale-item.entity';
import { ElectricSaleReturn } from './models/electric-sale-return.entity';
import { ElectricBillPayment } from './models/electric-bill-payment.entity';
import { ElectricDebtor } from 'src/electric-debtor/models/electric-debtor.entity';

@Injectable()
export class ElectricSaleService {
    constructor(
        private access: ElectricAccessService,
        private quotationService: ElectricQuotationService,
        @InjectRepository(ElectricSale, 'MainConnection') private readonly saleRepository: Repository<ElectricSale>,
        @InjectRepository(ElectricSaleItem, 'MainConnection') private readonly itemRepository: Repository<ElectricSaleItem>,
        @InjectRepository(ElectricSaleReturn, 'MainConnection') private readonly returnRepository: Repository<ElectricSaleReturn>,
        @InjectRepository(ElectricBillPayment, 'MainConnection') private readonly billPaymentRepository: Repository<ElectricBillPayment>,
        @InjectRepository(ElectricDebtor, 'MainConnection') private readonly debtorRepository: Repository<ElectricDebtor>,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
    ) { }

    private saleRelations = ['items', 'cashier', 'counter', 'clientstore', 'vendor', 'vendor.country'];

    async saleView(sale: ElectricSale) {
        const [returns, payments] = await Promise.all([
            this.returnRepository.find({ where: { sale: { id: sale.id } }, relations: ['items', 'processed_by_client', 'counter'], order: { id: 'ASC' } }),
            this.billPaymentRepository.find({ where: { sale: { id: sale.id } }, relations: ['received_by_client', 'counter'], order: { id: 'ASC' } }),
        ]);
        const { cashier, counter, clientstore, vendor, session, ...rest } = sale as any;
        const items = [...(sale.items || [])].sort((a, b) => a.id - b.id);
        return {
            ...rest,
            items,
            cashier: brief(cashier),
            counter: counter ? { id: counter.id, name: counter.name } : null,
            clientstore: shopView(clientstore),
            vendor: vendorView(vendor),
            item_count: roundAmount(items.reduce((sum, item) => sum + item.quantity, 0)),
            payment: paymentState(sale),
            payments: payments.map(({ received_by_client, counter: payCounter, sale: _, ...row }: any) => ({
                ...row,
                received_by: brief(received_by_client),
                counter: payCounter ? { id: payCounter.id, name: payCounter.name } : null,
            })),
            pending_costs: items.filter(isPending).length,
            profit: saleProfit(sale),
            returns: returns.map(({ processed_by_client, counter: returnCounter, sale: _, ...row }: any) => ({
                ...row,
                processed_by_user: brief(processed_by_client),
                counter: returnCounter ? { id: returnCounter.id, name: returnCounter.name } : null,
            })),
        };
    }

    summary(sales: ElectricSale[]) {
        const refunds = roundAmount(sales.reduce((sum, sale) => sum + sale.refunded_amount, 0));
        const total = roundAmount(sales.reduce((sum, sale) => sum + sale.total_amount, 0) - refunds);
        const pending = sales.reduce((sum, sale) => sum + (sale.items || []).filter(isPending).length, 0);
        return {
            netSales: total,
            refunds,
            returnedBills: sales.filter((sale) => sale.refunded_amount > 0).length,
            bills: sales.length,
            averageBill: sales.length ? roundAmount(total / sales.length) : 0,
            pendingBills: sales.filter((sale) => sale.khata_amount > 0).length,
            pendingAmount: roundAmount(sales.reduce((sum, sale) => sum + sale.khata_amount, 0)),
            dueToday: sales.filter((sale) => sale.khata_amount > 0 && paymentState(sale).due_today).length,
            overdue: sales.filter((sale) => sale.khata_amount > 0 && paymentState(sale).days_late > 0).length,
            discounts: roundAmount(sales.reduce((sum, sale) => sum + sale.item_discount + sale.bill_discount, 0)),
            profit: roundAmount(sales.reduce((sum, sale) => sum + saleProfit(sale), 0)),
            provisional: pending > 0,
            pendingItems: pending,
            itemsSold: roundAmount(sales.reduce((sum, sale) => sum + (sale.items || []).reduce((count, item) => count + item.quantity - (item.returned_quantity || 0), 0), 0)),
            payments: ['Cash', 'Card', 'Online'].map((method) => ({ method, amount: roundAmount(sales.filter((sale) => sale.payment_method === method).reduce((sum, sale) => sum + sale.total_amount, 0)) })),
        };
    }

    private async saleQuery(actor: AuthActor, body: ElectricListDto) {
        const shop = await this.access.shop(actor, body.clientstore_id);
        const own = await this.access.ownCounterId(actor);
        const query = this.saleRepository.createQueryBuilder('sale')
            .leftJoinAndSelect('sale.items', 'item')
            .leftJoinAndSelect('sale.cashier', 'cashier')
            .leftJoinAndSelect('sale.counter', 'counter')
            .where('sale.clientstore_id = :shopId', { shopId: shop.id });
        if (own !== null) query.andWhere('sale.counter_id = :own', { own });
        if (body.counter_id) query.andWhere('sale.counter_id = :counterId', { counterId: Number(body.counter_id) });
        if (body.payment_method) query.andWhere('sale.payment_method = :method', { method: body.payment_method });
        if (body.status) query.andWhere('sale.status = :status', { status: body.status });
        if (body.payment === 'Paid') query.andWhere('sale.khata_amount <= 0');
        if (body.payment === 'Pending') query.andWhere('sale.khata_amount > 0');
        if (body.payment === 'Overdue') query.andWhere('sale.khata_amount > 0 AND sale.due_date IS NOT NULL AND sale.due_date < CURDATE()');
        if (body.payment === 'Due today') query.andWhere('sale.khata_amount > 0 AND sale.due_date = CURDATE()');
        this.dateRange(query, 'sale', body);
        if (body.search) {
            query.andWhere('(sale.bill_number LIKE :search OR sale.customer_name LIKE :search OR sale.customer_phone LIKE :search)', { search: `%${body.search}%` });
        }
        return query;
    }

    private dateRange(query: SelectQueryBuilder<any>, alias: string, body: ElectricListDto) {
        if (body.startDate) query.andWhere(`${alias}.created_at >= :startDate`, { startDate: moment(body.startDate).startOf('day').toDate() });
        const end = body.endDate || body.startDate;
        if (end) query.andWhere(`${alias}.created_at <= :endDate`, { endDate: moment(end).endOf('day').toDate() });
    }

    async listSales(actor: AuthActor, body: ElectricListDto) {
        await this.access.need(actor, 'sales_view', 'You cannot see bills');
        const query = (await this.saleQuery(actor, body)).orderBy('sale.id', 'DESC');
        const result = await paginateQuery(query, Number(body.page) || 1, Number(body.take) || 10);
        return { ...result, data: await Promise.all(result.data.map((sale: ElectricSale) => this.saleView(sale))) };
    }

    async salesKpis(actor: AuthActor, body: ElectricListDto) {
        await this.access.need(actor, 'sales_view', 'You cannot see bills');
        return this.summary(await (await this.saleQuery(actor, body)).getMany());
    }

    async seeSale(actor: AuthActor, id: number) {
        const sale = await this.saleRepository.findOne({ where: { id }, relations: this.saleRelations });
        if (!sale) throw new NotFoundException('Bill not found');
        await this.access.shop(actor, sale.clientstore_id);
        if (!(await this.access.counterAllowed(actor, sale.counter_id))) {
            throw new ForbiddenException('This bill belongs to another counter');
        }
        return sale;
    }

    async sale(actor: AuthActor, id: number) {
        await this.access.need(actor, 'sales_view', 'You cannot see bills');
        return this.saleView(await this.seeSale(actor, id));
    }

    async createSale(actor: AuthActor, body: any) {
        await this.access.need(actor, 'pos_sell', 'You cannot make bills');
        if (body.quotation_id) {
            await this.access.need(actor, 'quotations_convert', 'You cannot convert quotations');
            await this.quotationService.seeQuotation(actor, Number(body.quotation_id));
        }
        const granted = await this.access.granted(actor);
        const record = await this.access.record(actor);
        const id = await this.dataSource.transaction((manager) => createSale(manager, record, body, { granted }));
        return this.saleView(await this.saleRepository.findOne({ where: { id }, relations: this.saleRelations }));
    }

    async returnSale(actor: AuthActor, id: number, body: any) {
        await this.access.need(actor, 'pos_return', 'You cannot return bills');
        const sale = await this.seeSale(actor, id);
        const record = await this.access.record(actor);
        const session = await this.access.sessionFor(actor, sale.clientstore_id, body.session_id);
        const returnId = await this.dataSource.transaction((manager) => returnSale(manager, record, sale.id, session, body));
        const view = await this.saleView(await this.saleRepository.findOne({ where: { id: sale.id }, relations: this.saleRelations }));
        return { sale: view, return: view.returns.find((row: any) => row.id === returnId) };
    }

    async payBill(actor: AuthActor, id: number, body: any) {
        await this.access.need(actor, 'sales_payment', 'You cannot take payments on bills');
        const sale = await this.seeSale(actor, id);
        const record = await this.access.record(actor);
        const session = await this.access.sessionFor(actor, sale.clientstore_id, body.session_id);
        await this.dataSource.transaction((manager) => payBill(manager, record, sale.id, session, body));
        return this.saleView(await this.saleRepository.findOne({ where: { id: sale.id }, relations: this.saleRelations }));
    }

    async attachDebtor(actor: AuthActor, id: number, body: any) {
        await this.access.need(actor, 'debtors_create', 'You cannot add debtors');
        const sale = await this.seeSale(actor, id);
        if (sale.debtor_id) {
            throw new BadRequestException('This bill is already on a khata');
        }
        if (sale.khata_amount <= 0) {
            throw new BadRequestException('This bill is already paid');
        }
        const debtorId = await this.dataSource.transaction(async (manager) => {
            if (body.debtor_id) {
                const existing = await manager.findOne(ElectricDebtor, { where: { id: Number(body.debtor_id), clientstore: { id: sale.clientstore_id } } });
                if (!existing) throw new NotFoundException('This customer is not on this shop\'s khata list');
                return existing.id;
            }
            const name = String(body.name || sale.customer_name || '').trim();
            if (!name) throw new BadRequestException('Enter the name for this khata');
            const phone = String(body.phone || sale.customer_phone || '').trim() || null;
            const saved = await manager.save(ElectricDebtor, {
                vendor: { id: actor.vendor_id },
                clientstore: { id: sale.clientstore_id },
                name,
                phone,
                address: body.address?.trim() || null,
                note: body.note?.trim() || null,
                opening_balance: 0,
                is_active: true,
            });
            return saved.id;
        });
        await this.saleRepository.update(sale.id, { debtor_id: debtorId });
        return this.saleView(await this.saleRepository.findOne({ where: { id: sale.id }, relations: this.saleRelations }));
    }

    async matchDebtor(actor: AuthActor, id: number) {
        const sale = await this.seeSale(actor, id);
        const phone = String(sale.customer_phone || '').trim();
        const name = String(sale.customer_name || '').trim();
        const found = phone
            ? await this.debtorRepository.findOne({ where: { phone, clientstore: { id: sale.clientstore_id } } })
            : null;
        return {
            name,
            phone,
            owing: sale.khata_amount,
            existing: found ? { id: found.id, name: found.name, phone: found.phone } : null,
        };
    }

    async pendingItems(shopId: number, options: { status?: string; sessionId?: number; counterId?: number | null } = {}) {
        const query = this.itemRepository.createQueryBuilder('item')
            .innerJoinAndSelect('item.sale', 'sale')
            .leftJoinAndSelect('sale.counter', 'counter')
            .leftJoinAndSelect('sale.cashier', 'cashier')
            .leftJoinAndSelect('sale.session', 'session')
            .where('sale.clientstore_id = :shopId AND item.is_outside = 1', { shopId })
            .orderBy('sale.created_at', 'DESC');
        if (options.sessionId) query.andWhere('sale.session_id = :sessionId', { sessionId: options.sessionId });
        if (options.counterId !== undefined && options.counterId !== null) query.andWhere('sale.counter_id = :counterId', { counterId: options.counterId });
        const items = await query.getMany();
        const enteredBy = [...new Set(items.map((item) => item.cost_entered_by).filter(Boolean))];
        const people = enteredBy.length ? await this.dataSource.query('SELECT id, full_name FROM clients WHERE id IN (?)', [enteredBy]) : [];
        const creditorIds = [...new Set(items.map((item) => item.creditor_id).filter(Boolean))];
        const creditors = creditorIds.length ? await this.dataSource.query('SELECT id, name FROM electric_creditors WHERE id IN (?)', [creditorIds]) : [];
        return items
            .map(({ sale, ...item }) => ({
                ...item,
                status: isPending(item as any) ? 'Pending' : item.cost_price === null ? 'Returned' : 'Entered',
                sale: { id: sale.id, bill_number: sale.bill_number, created_at: sale.created_at, customer_name: sale.customer_name },
                counter: sale.counter ? { id: sale.counter.id, name: sale.counter.name } : null,
                cashier: brief(sale.cashier),
                session_id: sale.session_id,
                session_status: sale.session?.status,
                entered_by: brief(people.find((person: any) => person.id === item.cost_entered_by)),
                creditor: creditors.find((row: any) => row.id === item.creditor_id) || null,
            }))
            .filter((item) => !options.status || item.status === options.status);
    }

    async listPending(actor: AuthActor, body: ElectricListDto) {
        await this.access.need(actor, 'pending_costs_view');
        const shop = await this.access.shop(actor, body.clientstore_id);
        const search = String(body.search || '').toLowerCase();
        const rows = (await this.pendingItems(shop.id, { status: body.status || undefined, sessionId: Number(body.session_id) || undefined, counterId: await this.access.ownCounterId(actor) }))
            .filter((item) => !search || [item.product_name, item.sale.bill_number, item.sale.customer_name].some((value) => String(value || '').toLowerCase().includes(search)));
        const take = Number(body.take) || 10;
        const page = Number(body.page) || 1;
        return { data: rows.slice((page - 1) * take, page * take), meta: { total: rows.length, page, last_page: Math.ceil(rows.length / take) } };
    }

    async pendingCount(actor: AuthActor, clientstoreId: any) {
        const shop = await this.access.shop(actor, clientstoreId);
        if (!(await this.access.can(actor, 'pending_costs_view'))) return { count: 0, mine: 0 };
        const items = await this.pendingItems(shop.id, { status: 'Pending', counterId: await this.access.ownCounterId(actor) });
        const session = await this.access.mySession(actor.id);
        return { count: items.length, mine: session ? items.filter((item) => item.session_id === session.id).length : 0 };
    }

    async enterCost(actor: AuthActor, itemId: number, cost: any, creditorId?: any) {
        await this.access.need(actor, 'pending_costs_edit', 'You cannot enter bought prices');
        const item = await this.itemRepository.findOne({ where: { id: itemId } });
        if (!item) throw new NotFoundException('Item not found');
        await this.seeSale(actor, item.sale_id);
        const saved = await this.dataSource.transaction((manager) => setItemCost(manager, actor.id, itemId, cost, creditorId));
        return { ...saved, profit: roundAmount(saved.total - saved.cost_price * saved.quantity) };
    }

    private shopSales(shopId: number, day: string) {
        return this.saleRepository.find({
            where: { clientstore: { id: shopId }, created_at: Between(moment(day).startOf('day').toDate(), moment(day).endOf('day').toDate()) },
            relations: ['items', 'cashier', 'counter'],
            order: { id: 'DESC' },
        });
    }

    async shopCard(shop: Clientstore, counters: any[]) {
        const sales = await this.shopSales(shop.id, dayKey());
        const [[products]] = await Promise.all([this.dataSource.query('SELECT COUNT(*) AS count FROM electric_products WHERE clientstore_id = ? AND is_active = 1 AND deleted_at IS NULL', [shop.id])]);
        return {
            ...shopView(shop),
            today: this.summary(sales),
            counters_total: counters.length,
            counters_open: counters.filter((counter) => counter.status === 'Open').length,
            pending_costs: (await this.pendingItems(shop.id, { status: 'Pending' })).length,
            products: Number(products.count),
            open_quotations: await this.quotationService.openCount(shop.id),
        };
    }

    async dashboard(shop: Clientstore, counters: any[]) {
        const today = await this.shopSales(shop.id, dayKey());
        const yesterday = await this.shopSales(shop.id, moment().subtract(1, 'day').format('YYYY-MM-DD'));
        const low = await this.dataSource.getRepository(ElectricProductVariant).createQueryBuilder('variant')
            .innerJoinAndSelect('variant.product', 'product')
            .where('product.clientstore_id = :shopId AND product.is_active = 1 AND variant.is_active = 1 AND variant.stock <= variant.reorder_level', { shopId: shop.id })
            .orderBy('variant.stock', 'ASC')
            .take(8)
            .getMany();
        const recent = await Promise.all(today.slice(0, 8).map((sale) => this.saleView(sale)));
        const owed = await this.saleRepository.createQueryBuilder('sale')
            .where('sale.clientstore_id = :shopId AND sale.khata_amount > 0', { shopId: shop.id })
            .orderBy('sale.due_date', 'ASC')
            .addOrderBy('sale.id', 'DESC')
            .getMany();
        const duePromises = owed
            .filter((sale) => sale.due_date && moment(sale.due_date).isSameOrBefore(moment(), 'day'))
            .map((sale) => ({
                id: sale.id,
                bill_number: sale.bill_number,
                customer_name: sale.customer_name,
                customer_phone: sale.customer_phone,
                debtor_id: sale.debtor_id,
                owing: sale.khata_amount,
                due_date: sale.due_date,
                ...paymentState(sale),
            }));
        return {
            payments_due: {
                bills: owed.length,
                total: roundAmount(owed.reduce((sum, sale) => sum + sale.khata_amount, 0)),
                due_today: duePromises.filter((row) => row.days_late === 0).length,
                overdue: duePromises.filter((row) => row.days_late > 0).length,
                list: duePromises.slice(0, 10),
            },
            today: this.summary(today),
            yesterday: this.summary(yesterday),
            pending_costs: (await this.pendingItems(shop.id, { status: 'Pending' })).length,
            open_quotations: await this.quotationService.openCount(shop.id),
            counters,
            recent_bills: recent,
            low_stock: low.map((variant) => ({ product_name: variant.product.name, variant_name: variant.name, stock: variant.stock, reorder_level: variant.reorder_level })),
        };
    }
}
