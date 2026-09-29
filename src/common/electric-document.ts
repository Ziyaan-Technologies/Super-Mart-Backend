import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import * as moment from 'moment-timezone';
import { roundAmount, roundQuantity } from './decimal.transformer';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { BillDiscount, calculateBill } from './bill-calculator';
import { ElectricCounter } from 'src/electric-counter/models/electric-counter.entity';
import { ElectricCounterSession, ElectricSessionStatus } from 'src/electric-counter/models/electric-counter-session.entity';
import { ElectricCashMove, ElectricCashMoveType } from 'src/electric-counter/models/electric-cash-move.entity';
import { ElectricProductVariant } from 'src/electric-product/models/electric-product-variant.entity';
import { ElectricCreditorEntry, ElectricCreditorEntryType } from 'src/electric-creditor/models/electric-creditor-entry.entity';
import { ElectricPaymentMethod, ElectricSale, ElectricSaleStatus } from 'src/electric-sale/models/electric-sale.entity';
import { ElectricSaleItem } from 'src/electric-sale/models/electric-sale-item.entity';
import { ElectricBillPayment } from 'src/electric-sale/models/electric-bill-payment.entity';
import { ElectricSaleReturn } from 'src/electric-sale/models/electric-sale-return.entity';
import { ElectricSaleReturnItem } from 'src/electric-sale/models/electric-sale-return-item.entity';
import { ElectricQuotation, ElectricQuotationStatus } from 'src/electric-quotation/models/electric-quotation.entity';
import { ElectricQuotationItem } from 'src/electric-quotation/models/electric-quotation-item.entity';
import { ElectricDebtor } from 'src/electric-debtor/models/electric-debtor.entity';
import { ElectricDebtorPayment } from 'src/electric-debtor/models/electric-debtor-payment.entity';
import { ElectricDiscountType } from './electric-document.entity';

export interface ElectricActor {
    id: number;
    vendor_id: number;
    electric_counter_id?: number | null;
}

export type Granted = Set<string> | null;

export function dayKey(value: Date | string = new Date()) {
    return moment(value).format('YYYY-MM-DD');
}

export function need(granted: Granted, key: string, message: string) {
    if (granted && !granted.has(key)) {
        throw new ForbiddenException(message);
    }
}

export function isPending(item: { is_outside: boolean; cost_price: number | null; returned_quantity: number; quantity: number }) {
    return item.is_outside && item.cost_price === null && (item.returned_quantity || 0) < item.quantity;
}

export function keptShare(item: { quantity: number; returned_quantity: number }) {
    return item.quantity ? (item.quantity - (item.returned_quantity || 0)) / item.quantity : 0;
}

export function saleProfit(sale: ElectricSale) {
    return roundAmount((sale.items || []).reduce((sum, item) => (item.cost_price === null ? sum : sum + (item.total - item.cost_price * item.quantity) * keptShare(item)), 0));
}

export function quotationStatus(quotation: ElectricQuotation) {
    if (quotation.status === ElectricQuotationStatus.OPEN && String(quotation.valid_until) < dayKey()) {
        return 'Expired';
    }
    return quotation.status;
}

export async function sessionTotals(manager: EntityManager, session: ElectricCounterSession) {
    const [sales, moves, refunds, khataPayments, [pending], duePromises] = await Promise.all([
        manager.query(
            `SELECT payment_method AS method, COUNT(*) AS bills, COALESCE(SUM(total_amount), 0) AS total, COALESCE(SUM(paid_amount), 0) AS paid,
                    COALESCE(SUM(khata_amount), 0) AS khata, COALESCE(SUM(item_discount + bill_discount), 0) AS discounts
             FROM electric_sales WHERE session_id = ? GROUP BY payment_method`,
            [session.id],
        ),
        manager.query(`SELECT type, COALESCE(SUM(amount), 0) AS amount FROM electric_cash_moves WHERE session_id = ? GROUP BY type`, [session.id]),
        manager.query(
            `SELECT refund_method AS method, COUNT(*) AS count, COALESCE(SUM(refund_amount - khata_amount), 0) AS amount, COALESCE(SUM(khata_amount), 0) AS khata
             FROM electric_sale_returns WHERE session_id = ? GROUP BY refund_method`,
            [session.id],
        ),
        manager.query(
            `SELECT method, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount FROM (
                SELECT method, amount FROM electric_debtor_payments WHERE session_id = ?
                UNION ALL
                SELECT method, amount FROM electric_bill_payments WHERE session_id = ?
             ) AS taken GROUP BY method`,
            [session.id, session.id],
        ),
        manager.query(
            `SELECT COUNT(*) AS count FROM electric_sale_items item JOIN electric_sales sale ON sale.id = item.sale_id
             WHERE sale.session_id = ? AND item.is_outside = 1 AND item.cost_price IS NULL AND item.returned_quantity < item.quantity`,
            [session.id],
        ),
        manager.query(
            `SELECT id, bill_number, customer_name, khata_amount, due_date FROM electric_sales
             WHERE clientstore_id = ? AND khata_amount > 0 AND due_date IS NOT NULL AND due_date <= CURDATE()
             ORDER BY due_date ASC`,
            [session.clientstore_id],
        ),
    ]);
    const byMethod = (method: string) => roundAmount(parseFloat(sales.find((row: any) => row.method === method)?.paid || 0));
    const refundBy = (method: string) => roundAmount(parseFloat(refunds.find((row: any) => row.method === method)?.amount || 0));
    const moved = (type: string) => roundAmount(parseFloat(moves.find((row: any) => row.type === type)?.amount || 0));
    const khataBy = (method: string) => roundAmount(parseFloat(khataPayments.find((row: any) => row.method === method)?.amount || 0));
    const cashSales = byMethod(ElectricPaymentMethod.CASH);
    const cashIn = moved(ElectricCashMoveType.IN);
    const cashOut = moved(ElectricCashMoveType.OUT);
    const cashRefunds = refundBy(ElectricPaymentMethod.CASH);
    const khataCash = khataBy(ElectricPaymentMethod.CASH);
    return {
        bills: sales.reduce((sum: number, row: any) => sum + Number(row.bills), 0),
        sales_total: roundAmount(sales.reduce((sum: number, row: any) => sum + parseFloat(row.total), 0)),
        discounts: roundAmount(sales.reduce((sum: number, row: any) => sum + parseFloat(row.discounts), 0)),
        cash_sales: cashSales,
        card_sales: byMethod(ElectricPaymentMethod.CARD),
        online_sales: byMethod(ElectricPaymentMethod.ONLINE),
        khata_sales: roundAmount(sales.reduce((sum: number, row: any) => sum + parseFloat(row.khata), 0)),
        khata_received: roundAmount(khataPayments.reduce((sum: number, row: any) => sum + parseFloat(row.amount), 0)),
        khata_received_cash: khataCash,
        khata_received_card: khataBy(ElectricPaymentMethod.CARD),
        khata_received_online: khataBy(ElectricPaymentMethod.ONLINE),
        khata_refunds: roundAmount(refunds.reduce((sum: number, row: any) => sum + parseFloat(row.khata), 0)),
        cash_in: cashIn,
        cash_out: cashOut,
        returns: refunds.reduce((sum: number, row: any) => sum + Number(row.count), 0),
        refunds_total: roundAmount(refunds.reduce((sum: number, row: any) => sum + parseFloat(row.amount), 0)),
        cash_refunds: cashRefunds,
        card_refunds: refundBy(ElectricPaymentMethod.CARD),
        online_refunds: refundBy(ElectricPaymentMethod.ONLINE),
        cash_now: roundAmount(session.opening_cash + cashSales + khataCash + cashIn - cashOut - cashRefunds),
        pending_costs: Number(pending?.count || 0),
        due_promises: duePromises.map((row: any) => ({
            id: row.id,
            bill_number: row.bill_number,
            customer_name: row.customer_name,
            owing: roundAmount(parseFloat(row.khata_amount)),
            due_date: row.due_date,
        })),
    };
}

export async function nextNumber(manager: EntityManager, clientstoreId: number, kind: 'B' | 'Q' | 'R') {
    const shop = await manager.createQueryBuilder(Clientstore, 'shop').setLock('pessimistic_write').where('shop.id = :id', { id: clientstoreId }).getOne();
    const table = kind === 'B' ? ElectricSale : kind === 'Q' ? ElectricQuotation : ElectricSaleReturn;
    const count = await manager.count(table as any, { where: { clientstore: { id: clientstoreId } } });
    return `${shop.store_code}-${kind}${1001 + count}`;
}

export async function openSession(manager: EntityManager, actor: ElectricActor, counterId: number, openingCash: number, at = new Date()) {
    const counter = await manager.findOne(ElectricCounter, { where: { id: counterId, vendor: { id: actor.vendor_id } } });
    if (!counter || !counter.is_active) {
        throw new NotFoundException('Counter not found');
    }
    if (await manager.findOne(ElectricCounterSession, { where: { counter: { id: counter.id }, status: ElectricSessionStatus.OPEN } })) {
        throw new BadRequestException(`${counter.name} is already open`);
    }
    if (await manager.findOne(ElectricCounterSession, { where: { cashier: { id: actor.id }, status: ElectricSessionStatus.OPEN } })) {
        throw new BadRequestException('You already have an open counter. Close it first.');
    }
    if (actor.electric_counter_id && actor.electric_counter_id !== counter.id) {
        throw new BadRequestException('You can only open your own counter');
    }
    if (!(Number(openingCash) >= 0)) {
        throw new BadRequestException('Opening cash cannot be negative');
    }
    const session = await manager.save(ElectricCounterSession, {
        vendor: { id: actor.vendor_id },
        clientstore: { id: counter.clientstore_id },
        counter: { id: counter.id },
        cashier: { id: actor.id },
        status: ElectricSessionStatus.OPEN,
        opening_cash: roundAmount(Number(openingCash)),
        opened_at: at,
    });
    await manager.update(ElectricCounterSession, session.id, { session_number: `S-${String(session.id).padStart(4, '0')}` });
    return manager.findOne(ElectricCounterSession, { where: { id: session.id } });
}

export async function addCashMove(manager: EntityManager, actorId: number, session: ElectricCounterSession, body: any, at = new Date()) {
    if (session.status !== ElectricSessionStatus.OPEN) {
        throw new BadRequestException('This counter is closed');
    }
    const type = body.type === ElectricCashMoveType.IN ? ElectricCashMoveType.IN : ElectricCashMoveType.OUT;
    const amount = roundAmount(Number(body.amount));
    if (!(amount > 0)) {
        throw new BadRequestException('Enter an amount above zero');
    }
    if (!String(body.reason || '').trim()) {
        throw new BadRequestException('Choose a reason');
    }
    // a shop expense lands in the daily expense book, so it must say what it was for
    if (String(body.reason).trim() === 'Shop expense' && !String(body.note || '').trim()) {
        throw new BadRequestException('Write what the expense was for');
    }
    if (type === ElectricCashMoveType.OUT && amount > (await sessionTotals(manager, session)).cash_now) {
        throw new BadRequestException('Cash out is more than the cash in the counter');
    }
    return manager.save(ElectricCashMove, {
        session: { id: session.id },
        counter: { id: session.counter_id },
        clientstore: { id: session.clientstore_id },
        type,
        reason: String(body.reason).trim(),
        amount,
        note: body.note?.trim() || null,
        created_by_client: { id: actorId },
        created_at: at,
    });
}

export async function closeSession(manager: EntityManager, session: ElectricCounterSession, body: any, at = new Date()) {
    if (session.status !== ElectricSessionStatus.OPEN) {
        throw new BadRequestException('This counter is already closed');
    }
    const totals = await sessionTotals(manager, session);
    if (totals.pending_costs) {
        throw new BadRequestException(`Enter the bought price of ${totals.pending_costs} item${totals.pending_costs === 1 ? '' : 's'} before closing this counter`);
    }
    const counted = Number(body.closing_cash);
    if (body.closing_cash === '' || body.closing_cash === null || body.closing_cash === undefined || !(counted >= 0)) {
        throw new BadRequestException('Enter the cash counted in the counter');
    }
    await manager.update(ElectricCounterSession, session.id, {
        status: ElectricSessionStatus.CLOSED,
        expected_cash: totals.cash_now,
        closing_cash: roundAmount(counted),
        cash_difference: roundAmount(counted - totals.cash_now),
        note: body.note?.trim() || null,
        closed_at: at,
    });
    await manager.update(ElectricCounter, session.counter_id, { drawer_cash: roundAmount(counted) });
    return manager.findOne(ElectricCounterSession, { where: { id: session.id } });
}

export const lineKey = (line: any) => `${line.variant_id}|${Number(line.unit_price)}|${line.discount_type || 'percent'}|${Number(line.discount_value) || 0}`;

/** the shopkeepers this shop's business owes money to */
async function shopCreditors(manager: EntityManager, shopId: number, ids: number[]) {
    if (!ids.length) {
        return new Set<number>();
    }
    const rows = await manager.query(
        'SELECT id FROM electric_creditors WHERE clientstore_id = ? AND id IN (?) AND is_active = 1',
        [shopId, ids],
    );
    return new Set<number>(rows.map((row: any) => Number(row.id)));
}

/** what we owe a shopkeeper for an item of his is his cost times the pieces the customer kept */
export async function syncCreditorEntry(manager: EntityManager, itemId: number, actorId: number) {
    const item = await manager.findOne(ElectricSaleItem, { where: { id: itemId } });
    const existing = await manager.findOne(ElectricCreditorEntry, { where: { sale_item: { id: itemId } } });
    const kept = item ? roundQuantity(item.quantity - (item.returned_quantity || 0)) : 0;
    const amount = item && item.creditor_id && item.cost_price !== null && kept > 0 ? roundAmount(item.cost_price * kept) : 0;
    if (!amount) {
        if (existing) {
            await manager.delete(ElectricCreditorEntry, existing.id);
        }
        return;
    }
    const sale = await manager.findOne(ElectricSale, { where: { id: item.sale_id } });
    const returned = roundQuantity(item.returned_quantity || 0);
    const note = [`${item.product_name} · ${kept} pcs`, sale?.bill_number, returned ? `${returned} returned` : null].filter(Boolean).join(' · ');
    if (existing) {
        await manager.update(ElectricCreditorEntry, existing.id, { creditor: { id: item.creditor_id }, amount, note });
        return;
    }
    const [creditor] = await manager.query('SELECT vendor_id FROM electric_creditors WHERE id = ?', [item.creditor_id]);
    await manager.save(ElectricCreditorEntry, {
        creditor: { id: item.creditor_id },
        vendor: { id: Number(creditor.vendor_id) },
        clientstore: sale ? { id: sale.clientstore_id } : null,
        sale_item: { id: item.id },
        type: ElectricCreditorEntryType.ITEM,
        amount,
        note,
        created_by_client: { id: actorId },
    });
}

export async function prepareLines(manager: EntityManager, granted: Granted, shopId: number, lines: any[], checkStock: boolean, approved = new Set<string>()) {
    if (!Array.isArray(lines) || !lines.length) {
        throw new BadRequestException('Add at least one item');
    }
    const variantIds = lines.filter((line) => !line.is_outside).map((line) => Number(line.variant_id)).filter(Boolean);
    const query = manager.createQueryBuilder(ElectricProductVariant, 'variant')
        .innerJoinAndSelect('variant.product', 'product')
        .where('variant.id IN (:...ids)', { ids: variantIds.length ? variantIds : [0] });
    if (checkStock) {
        query.setLock('pessimistic_write');
    }
    const variants = await query.getMany();
    const creditors = await shopCreditors(manager, shopId, lines.filter((line) => line.is_outside && line.creditor_id).map((line) => Number(line.creditor_id)));
    const used = new Map<number, number>();
    return lines.map((line) => {
        const quantity = roundQuantity(Number(line.quantity));
        if (!(quantity > 0)) {
            throw new BadRequestException(`Quantity of ${line.product_name || 'an item'} must be above zero`);
        }
        const price = roundAmount(Number(line.unit_price));
        if (!(price >= 0)) {
            throw new BadRequestException(`Price of ${line.product_name || 'an item'} cannot be negative`);
        }
        const discount = {
            discount_type: line.discount_type === ElectricDiscountType.AMOUNT ? ElectricDiscountType.AMOUNT : ElectricDiscountType.PERCENT,
            discount_value: Math.max(0, Number(line.discount_value) || 0),
            bill_discount_code: line.bill_discount_code || null,
        };
        if (line.is_outside) {
            need(granted, 'pos_outside_item', 'You cannot add items from another shopkeeper');
            if (!String(line.product_name || '').trim()) {
                throw new BadRequestException('Outside item needs a name');
            }
            const creditorId = line.creditor_id ? Number(line.creditor_id) : null;
            if (creditorId && !creditors.has(creditorId)) {
                throw new BadRequestException('That shopkeeper is not on your creditor list');
            }
            return { ...discount, product_id: null, variant_id: null, product_name: String(line.product_name).trim(), variant_name: '', image_url: null, quantity, unit_price: price, original_price: price, cost_price: null, is_outside: true, creditor_id: creditorId };
        }
        const variant = variants.find((row) => row.id === Number(line.variant_id));
        if (!variant || variant.product.clientstore_id !== shopId || !variant.product.is_active || !variant.is_active) {
            throw new BadRequestException(`${line.product_name || 'An item'} is not in this shop`);
        }
        const product = variant.product;
        const trusted = !granted || approved.has(lineKey(line));
        if (!trusted && price !== variant.sale_price) need(granted, 'pos_price_edit', 'You cannot change prices');
        if (!trusted && price < variant.cost_price) need(granted, 'pos_below_cost', `${product.name} ${variant.name} is below its cost`);
        if (!trusted && discount.discount_value > 0) need(granted, 'pos_item_discount', 'You cannot give item discounts');
        if (checkStock) {
            const total = roundQuantity((used.get(variant.id) || 0) + quantity);
            if (total > variant.stock) {
                throw new BadRequestException(`Only ${variant.stock} of ${product.name} ${variant.name} left`);
            }
            used.set(variant.id, total);
        }
        return {
            ...discount,
            product_id: product.id,
            variant_id: variant.id,
            product_name: product.name,
            variant_name: variant.name,
            image_url: product.image_url,
            quantity,
            unit_price: price,
            original_price: variant.sale_price,
            cost_price: variant.cost_price,
            is_outside: false,
            creditor_id: null,
        };
    });
}

export function documentLines(lines: any[], discounts: BillDiscount[]) {
    const bill = calculateBill(lines, discounts);
    return { bill, items: lines.map((line, index) => ({ ...line, ...bill.lines[index] })) };
}

export function cleanDiscounts(value: any): BillDiscount[] {
    return (Array.isArray(value) ? value : []).map((discount) => ({
        code: String(discount.code),
        type: discount.type === 'amount' ? 'amount' : 'percent',
        value: Number(discount.value) || 0,
    }));
}

export async function createSale(manager: EntityManager, actor: ElectricActor, body: any, options: { granted: Granted; at?: Date }) {
    const { granted } = options;
    const session = await manager.findOne(ElectricCounterSession, { where: { id: Number(body.session_id) } });
    if (!session || session.status !== ElectricSessionStatus.OPEN) {
        throw new BadRequestException('Open a counter before making a bill');
    }
    if (granted && session.cashier_id !== actor.id && !granted.has('pos_any_counter')) {
        throw new ForbiddenException('This counter is opened by someone else');
    }
    const quotation = body.quotation_id ? await manager.findOne(ElectricQuotation, { where: { id: Number(body.quotation_id) }, relations: ['items'] }) : null;
    if (body.quotation_id && !quotation) {
        throw new NotFoundException('Quotation not found');
    }
    if (quotation && quotationStatus(quotation) !== ElectricQuotationStatus.OPEN) {
        throw new BadRequestException(`This quotation is ${String(quotationStatus(quotation)).toLowerCase()}`);
    }
    if (quotation && quotation.clientstore_id !== session.clientstore_id) {
        throw new BadRequestException('This quotation belongs to another shop');
    }
    const discounts = cleanDiscounts(body.bill_discounts);
    const quoted = new Set((quotation?.bill_discounts || []).map((discount: any) => `${discount.code}|${discount.type}|${Number(discount.value)}`));
    const discountsTrusted = discounts.every((discount) => quoted.has(`${discount.code}|${discount.type}|${Number(discount.value)}`));
    if (!discountsTrusted && discounts.some((discount) => discount.value > 0)) {
        need(granted, 'pos_bill_discount', 'You cannot give bill discounts');
    }
    const approved = new Set<string>((quotation?.items || []).map(lineKey));
    const lines = await prepareLines(manager, granted, session.clientstore_id, body.lines, true, approved);
    const { bill, items } = documentLines(lines, discounts);
    const method = Object.values(ElectricPaymentMethod).includes(body.payment_method) ? body.payment_method : ElectricPaymentMethod.CASH;
    const debtor = body.debtor_id
        ? await manager.findOne(ElectricDebtor, { where: { id: Number(body.debtor_id), clientstore: { id: session.clientstore_id } } })
        : null;
    if (body.debtor_id && !debtor) {
        throw new NotFoundException('This customer is not on this shop\'s khata list');
    }
    const dueDate = String(body.due_date || '').trim() || null;
    const payLater = !!debtor || !!dueDate || body.paid_amount !== undefined;
    const paid = payLater
        ? roundAmount(Math.min(Math.max(Number(body.paid_amount) || 0, 0), bill.total))
        : bill.total;
    const khata = roundAmount(bill.total - paid);
    if (khata > 0) {
        need(granted, debtor ? 'pos_debtor_sale' : 'pos_pay_later', debtor
            ? 'You cannot put a bill on a khata'
            : 'You cannot take a bill without full payment');
        if (!debtor && !String(body.customer_name || '').trim()) {
            throw new BadRequestException('Enter the customer name for a pay later bill');
        }
        if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            throw new BadRequestException('The promised date is not a valid date');
        }
    }
    const received = method === ElectricPaymentMethod.CASH ? roundAmount(Number(body.amount_received ?? paid)) : paid;
    if (method === ElectricPaymentMethod.CASH && received < paid) {
        throw new BadRequestException(debtor ? 'Cash received is less than the amount being paid' : 'Cash received is less than the bill total');
    }
    for (const item of items.filter((row) => !row.is_outside)) {
        await manager.decrement(ElectricProductVariant, { id: item.variant_id }, 'stock', item.quantity);
    }
    const sale = await manager.save(ElectricSale, {
        bill_number: await nextNumber(manager, session.clientstore_id, 'B'),
        vendor: { id: session.vendor_id },
        clientstore: { id: session.clientstore_id },
        counter: { id: session.counter_id },
        session: { id: session.id },
        cashier: { id: actor.id },
        quotation_id: quotation?.id || null,
        debtor_id: debtor?.id || null,
        customer_name: debtor?.name || body.customer_name?.trim() || null,
        customer_phone: debtor?.phone || body.customer_phone?.trim() || null,
        note: body.note?.trim() || null,
        bill_discounts: bill.discounts,
        subtotal: bill.subtotal,
        item_discount: bill.item_discount,
        bill_discount: bill.bill_discount,
        total_amount: bill.total,
        payment_method: method,
        amount_received: received,
        change_amount: roundAmount(received - paid),
        paid_amount: paid,
        khata_amount: khata,
        due_date: khata > 0 ? dueDate : null,
        refunded_amount: 0,
        status: ElectricSaleStatus.COMPLETED,
        ...(options.at ? { created_at: options.at } : {}),
    });
    await manager.save(ElectricSaleItem, items.map((item) => ({ ...item, sale: { id: sale.id }, returned_quantity: 0 })));
    if (quotation) {
        await manager.update(ElectricQuotation, quotation.id, { status: ElectricQuotationStatus.CONVERTED, sale_id: sale.id });
    }
    return sale.id;
}

export async function createQuotation(manager: EntityManager, actor: ElectricActor, body: any, options: { granted: Granted; at?: Date }) {
    const { granted } = options;
    const shopId = Number(body.clientstore_id);
    const discounts = cleanDiscounts(body.bill_discounts);
    if (discounts.some((discount) => discount.value > 0)) {
        need(granted, 'pos_bill_discount', 'You cannot give bill discounts');
    }
    const lines = await prepareLines(manager, granted, shopId, body.lines, false);
    const { bill, items } = documentLines(lines, discounts);
    const session = await manager.findOne(ElectricCounterSession, { where: { cashier: { id: actor.id }, status: ElectricSessionStatus.OPEN, clientstore: { id: shopId } } });
    const counterId = session?.counter_id || actor.electric_counter_id || null;
    const at = options.at || new Date();
    const quotation = await manager.save(ElectricQuotation, {
        quotation_number: await nextNumber(manager, shopId, 'Q'),
        vendor: { id: actor.vendor_id },
        clientstore: { id: shopId },
        counter: counterId ? { id: counterId } : null,
        created_by_client: { id: actor.id },
        customer_name: body.customer_name?.trim() || null,
        customer_phone: body.customer_phone?.trim() || null,
        note: body.note?.trim() || null,
        valid_until: body.valid_until || moment(at).add(7, 'days').format('YYYY-MM-DD'),
        show_item_prices: body.show_item_prices !== false,
        bill_discounts: bill.discounts,
        subtotal: bill.subtotal,
        item_discount: bill.item_discount,
        bill_discount: bill.bill_discount,
        total_amount: bill.total,
        status: ElectricQuotationStatus.OPEN,
        ...(options.at ? { created_at: options.at } : {}),
    });
    await manager.save(ElectricQuotationItem, items.map((item) => ({ ...item, quotation: { id: quotation.id } })));
    return quotation.id;
}

export async function returnSale(manager: EntityManager, actor: ElectricActor, saleId: number, session: ElectricCounterSession | null, body: any, at = new Date()) {
    const sale = await manager.createQueryBuilder(ElectricSale, 'sale').setLock('pessimistic_write').where('sale.id = :saleId', { saleId }).getOne();
    if (!sale) {
        throw new NotFoundException('Bill not found');
    }
    if (sale.status === ElectricSaleStatus.RETURNED) {
        throw new BadRequestException('Everything on this bill has already been returned');
    }
    if (!session || session.status !== ElectricSessionStatus.OPEN || session.clientstore_id !== sale.clientstore_id) {
        throw new BadRequestException('Open your counter in this shop before making a return');
    }
    const method = Object.values(ElectricPaymentMethod).includes(body.refund_method) ? body.refund_method : ElectricPaymentMethod.CASH;
    const reason = String(body.reason || '').trim();
    if (!reason) {
        throw new BadRequestException('Enter the reason for the return');
    }
    const requested = new Map<number, number>();
    (Array.isArray(body.items) ? body.items : []).forEach((line: any) => {
        const quantity = roundQuantity(Number(line.quantity) || 0);
        if (quantity > 0) requested.set(Number(line.sale_item_id), roundQuantity((requested.get(Number(line.sale_item_id)) || 0) + quantity));
    });
    if (!requested.size) {
        throw new BadRequestException('Enter the quantity being returned');
    }
    const items = await manager.find(ElectricSaleItem, { where: { sale: { id: sale.id } } });
    const lines: { item: ElectricSaleItem; quantity: number; refund: number }[] = [];
    requested.forEach((quantity, itemId) => {
        const item = items.find((row) => row.id === itemId);
        if (!item) {
            throw new BadRequestException('A returned line does not belong to this bill');
        }
        const returnable = roundQuantity(item.quantity - (item.returned_quantity || 0));
        if (quantity > returnable) {
            throw new BadRequestException(`${item.product_name} ${item.variant_name}: only ${returnable} can still be returned`);
        }
        lines.push({ item, quantity, refund: roundAmount(item.total * quantity / item.quantity) });
    });
    const refund = roundAmount(lines.reduce((sum, line) => sum + line.refund, 0));
    const khataBack = sale.debtor_id ? roundAmount(Math.min(refund, sale.khata_amount)) : 0;
    const moneyBack = roundAmount(refund - khataBack);
    if (method === ElectricPaymentMethod.CASH && moneyBack > (await sessionTotals(manager, session)).cash_now) {
        throw new BadRequestException('Not enough cash in your counter for this refund');
    }
    for (const { item, quantity } of lines) {
        item.returned_quantity = roundQuantity((item.returned_quantity || 0) + quantity);
        await manager.update(ElectricSaleItem, item.id, { returned_quantity: item.returned_quantity });
        if (!item.is_outside && item.variant_id) {
            await manager.increment(ElectricProductVariant, { id: item.variant_id }, 'stock', quantity);
        }
        if (item.is_outside && item.creditor_id) {
            await syncCreditorEntry(manager, item.id, actor.id);
        }
    }
    const saleReturn = await manager.save(ElectricSaleReturn, {
        return_number: await nextNumber(manager, sale.clientstore_id, 'R'),
        sale: { id: sale.id },
        clientstore: { id: sale.clientstore_id },
        counter: { id: session.counter_id },
        session: { id: session.id },
        processed_by_client: { id: actor.id },
        refund_method: method,
        reason,
        refund_amount: refund,
        khata_amount: khataBack,
        created_at: at,
    });
    await manager.save(ElectricSaleReturnItem, lines.map(({ item, quantity, refund: amount }) => ({
        sale_return: { id: saleReturn.id },
        sale_item_id: item.id,
        product_name: item.product_name,
        variant_name: item.variant_name,
        quantity,
        unit_price: item.unit_price,
        refund_amount: amount,
    })));
    const fullyReturned = items.every((item) => (item.returned_quantity || 0) >= item.quantity);
    await manager.update(ElectricSale, sale.id, {
        refunded_amount: roundAmount(sale.refunded_amount + refund),
        khata_amount: roundAmount(sale.khata_amount - khataBack),
        status: fullyReturned ? ElectricSaleStatus.RETURNED : ElectricSaleStatus.PARTIALLY_RETURNED,
    });
    return saleReturn.id;
}

export async function payBill(manager: EntityManager, actor: ElectricActor, saleId: number, session: ElectricCounterSession | null, body: any, at = new Date()) {
    const sale = await manager.createQueryBuilder(ElectricSale, 'sale').setLock('pessimistic_write').where('sale.id = :saleId', { saleId }).getOne();
    if (!sale) {
        throw new NotFoundException('Bill not found');
    }
    const owing = roundAmount(sale.khata_amount);
    if (owing <= 0) {
        throw new BadRequestException('This bill is already paid');
    }
    const amount = roundAmount(Number(body.amount) || 0);
    if (amount <= 0) {
        throw new BadRequestException('Enter the amount being paid');
    }
    if (amount > owing) {
        throw new BadRequestException(`Only ${owing} is left on this bill`);
    }
    if (!session || session.status !== ElectricSessionStatus.OPEN || session.clientstore_id !== sale.clientstore_id) {
        throw new BadRequestException('Open your counter in this shop before taking a payment');
    }
    const method = Object.values(ElectricPaymentMethod).includes(body.method) ? body.method : ElectricPaymentMethod.CASH;
    await manager.save(ElectricBillPayment, {
        sale: { id: sale.id },
        vendor: { id: sale.vendor_id },
        clientstore: { id: sale.clientstore_id },
        counter: { id: session.counter_id },
        session: { id: session.id },
        amount,
        method,
        note: body.note?.trim() || null,
        received_by_client: { id: actor.id },
        created_at: at,
    });
    await manager.update(ElectricSale, sale.id, {
        khata_amount: roundAmount(owing - amount),
        due_date: roundAmount(owing - amount) > 0 ? sale.due_date : null,
    });
    return sale.id;
}

export function paymentState(sale: { total_amount: number; paid_amount: number; khata_amount: number; due_date?: string | null; refunded_amount?: number }) {
    const owing = roundAmount(sale.khata_amount);
    const settled = roundAmount(sale.total_amount - owing);
    if (owing <= 0) {
        return { state: 'Paid', owing: 0, settled, days_late: 0, due_today: false };
    }
    const due = sale.due_date ? moment(sale.due_date).endOf('day') : null;
    const late = due && moment().isAfter(due) ? moment().startOf('day').diff(moment(sale.due_date).startOf('day'), 'days') : 0;
    return {
        state: late > 0 ? 'Overdue' : (settled > 0 ? 'Partly paid' : 'Pending'),
        owing,
        settled,
        days_late: late,
        due_today: !!due && moment().isSame(moment(sale.due_date), 'day'),
    };
}

export async function setItemCost(manager: EntityManager, actorId: number, itemId: number, cost: any, creditorId?: any, at = new Date()) {
    const item = await manager.findOne(ElectricSaleItem, { where: { id: itemId } });
    if (!item || !item.is_outside) {
        throw new NotFoundException('Item not found');
    }
    const value = Number(cost);
    if (cost === '' || cost === null || cost === undefined || !(value >= 0)) {
        throw new BadRequestException('Enter the bought price');
    }
    const data: any = { cost_price: roundAmount(value), cost_entered_at: at, cost_entered_by: actorId };
    if (creditorId !== undefined) {
        const chosen = creditorId ? Number(creditorId) : null;
        if (chosen) {
            const sale = await manager.findOne(ElectricSale, { where: { id: item.sale_id } });
            if (!(await shopCreditors(manager, sale.clientstore_id, [chosen])).has(chosen)) {
                throw new BadRequestException('That shopkeeper is not on your creditor list');
            }
        }
        data.creditor_id = chosen;
    }
    await manager.update(ElectricSaleItem, item.id, data);
    await syncCreditorEntry(manager, item.id, actorId);
    return manager.findOne(ElectricSaleItem, { where: { id: item.id } });
}

export function brief(client: any) {
    return client ? { id: client.id, full_name: client.full_name } : null;
}

export function vendorView(vendor: any) {
    if (!vendor) return null;
    return {
        id: vendor.id,
        business_name: vendor.business_name,
        country: vendor.country ? { id: vendor.country.id, name: vendor.country.name, currency_symbol: vendor.country.currency_symbol, currency_short_name: vendor.country.currency_short_name } : null,
    };
}

export function shopView(shop: any) {
    if (!shop) return null;
    return {
        id: shop.id,
        store_name: shop.store_name,
        store_code: shop.store_code,
        store_type: shop.store_type,
        address: shop.address,
        store_phone: shop.store_phone,
        store_phones: shop.store_phones || [],
        image_url: shop.image_url,
        is_active: shop.is_active,
    };
}

