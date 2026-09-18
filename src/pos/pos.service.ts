import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import * as moment from 'moment-timezone';
import { ActorType, AuthActor } from 'src/common/auth-actor';
import { documentNumber } from 'src/common/document-number';
import { roundAmount, roundQuantity } from 'src/common/decimal.transformer';
import { assertStoreDocumentAccess } from 'src/common/tenant-scope';
import { ClientstoreService } from 'src/clientstore/clientstore.service';
import { ProductService } from 'src/product/product.service';
import { ProductVariant } from 'src/product/models/product-variant.entity';
import { StockService } from 'src/stock/stock.service';
import { StockMovementType } from 'src/stock/models/stock-movement.entity';
import { User } from 'src/user/models/user.entity';
import { Bank } from 'src/bank/models/bank.entity';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { ClientType } from 'src/client/models/client.entity';
import { RegisterSession, RegisterSessionStatus } from './models/register-session.entity';
import { Sale, SaleStatus } from './models/sale.entity';
import { SaleItem } from './models/sale-item.entity';
import { PaymentMethod, SalePayment } from './models/sale-payment.entity';
import { SaleReturn } from './models/sale-return.entity';
import { SaleReturnItem } from './models/sale-return-item.entity';
import { CloseRegisterDto, OpeningCashDto, OpenRegisterDto, SaleCreateDto, SaleLineDto, SaleReturnDto } from './models/pos.dto';

export interface PricedSaleLine {
    variant: ProductVariant;
    quantity: number;
    unit_price: number;
    gross: number;
    discount_amount: number;
    bill_discount_share: number;
    tax_rate: number;
    price_includes_tax: boolean;
    tax_amount: number;
    line_total: number;
}

@Injectable()
export class PosService {
    constructor(
        @InjectRepository(RegisterSession, 'MainConnection') private readonly sessionRepository: Repository<RegisterSession>,
        @InjectRepository(Sale, 'MainConnection') private readonly saleRepository: Repository<Sale>,
        @InjectRepository(SaleReturn, 'MainConnection') private readonly returnRepository: Repository<SaleReturn>,
        @InjectRepository(User, 'MainConnection') private readonly userRepository: Repository<User>,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
        private clientstoreService: ClientstoreService,
        private productService: ProductService,
        private stockService: StockService,
    ) {
    }

    readonly saleRelations = ['clientstore', 'clientstore.city', 'vendor', 'vendor.country', 'cashier', 'customer', 'items', 'payments', 'register_session'];

    async resolveStore(actor: AuthActor, clientstoreId: number) {
        const storeId = actor.type === ActorType.CLIENT && actor.clientstore_id ? actor.clientstore_id : Number(clientstoreId);
        if (!storeId) {
            throw new BadRequestException('Choose a store first');
        }
        return this.clientstoreService.accessible(actor, storeId);
    }

    async currentSession(actor: AuthActor, clientstoreId?: number) {
        const where: any = { cashier: { id: actor.id }, status: RegisterSessionStatus.OPEN };
        if (clientstoreId) {
            where.clientstore = { id: clientstoreId };
        }
        return this.sessionRepository.findOne({ where, relations: ['clientstore'] });
    }

    async openSession(actor: AuthActor, body: OpenRegisterDto) {
        const store = await this.resolveStore(actor, body.clientstore_id);
        if (!store.is_active || !store.is_pos_active) {
            throw new BadRequestException(`POS is not enabled for ${store.store_name}`);
        }
        const existing = await this.currentSession(actor);
        if (existing) {
            throw new BadRequestException(`You already have an open register at ${existing.clientstore?.store_name}. Close it first.`);
        }
        const session = await this.sessionRepository.save({
            vendor: { id: store.vendor_id },
            clientstore: { id: store.id },
            cashier: { id: actor.id },
            opening_cash: roundAmount(store.drawer_cash),
            note: body.note || null,
            status: RegisterSessionStatus.OPEN,
            opened_at: new Date(),
        });
        await this.sessionRepository.update(session.id, { session_number: documentNumber('REG', session.id) });
        return this.sessionSummary(actor, session.id, false);
    }

    // Only the business owner decides how much cash sits in a branch drawer. The new amount also
    // becomes the opening cash of any counter already open at that branch.
    async setOpeningCash(actor: AuthActor, body: OpeningCashDto) {
        if (actor.client_type !== ClientType.OWNER) {
            throw new ForbiddenException('Only the owner can set the opening cash');
        }
        const store = await this.resolveStore(actor, body.clientstore_id);
        const openingCash = roundAmount(body.opening_cash);
        await this.dataSource.transaction(async (manager) => {
            await manager.update(Clientstore, store.id, { drawer_cash: openingCash });
            await manager.update(RegisterSession, { clientstore: { id: store.id }, status: RegisterSessionStatus.OPEN }, { opening_cash: openingCash });
        });
        return { clientstore_id: store.id, drawer_cash: openingCash };
    }

    async accessibleSession(actor: AuthActor, id: number, canManage: boolean) {
        const session = await this.sessionRepository.findOne({ where: { id }, relations: ['clientstore', 'cashier'] });
        if (!session) {
            throw new NotFoundException('Register session not found');
        }
        assertStoreDocumentAccess(actor, session.vendor_id, [session.clientstore_id]);
        if (!canManage && session.cashier_id !== actor.id) {
            throw new ForbiddenException('You can only see your own register');
        }
        return session;
    }

    async sessionTotals(sessionId: number) {
        const payments = await this.dataSource.query(
            `SELECT sp.method AS method, COALESCE(SUM(sp.amount), 0) AS amount
             FROM sale_payments sp INNER JOIN sales s ON s.id = sp.sale_id
             WHERE s.register_session_id = ? GROUP BY sp.method`,
            [sessionId],
        );
        const [sales] = await this.dataSource.query(
            `SELECT COUNT(*) AS bills, COALESCE(SUM(total_amount), 0) AS total, COALESCE(SUM(change_amount), 0) AS change_given,
                    COALESCE(SUM(item_discount + bill_discount), 0) AS discounts, COALESCE(SUM(tax_amount), 0) AS tax
             FROM sales WHERE register_session_id = ?`,
            [sessionId],
        );
        const refunds = await this.dataSource.query(
            `SELECT refund_method AS method, COUNT(*) AS count, COALESCE(SUM(refund_amount), 0) AS amount
             FROM sale_returns WHERE register_session_id = ? GROUP BY refund_method`,
            [sessionId],
        );
        const byMethod = Object.values(PaymentMethod).map((method) => ({
            method,
            collected: roundAmount(parseFloat(payments.find((row) => row.method === method)?.amount || 0)),
            refunded: roundAmount(parseFloat(refunds.find((row) => row.method === method)?.amount || 0)),
        }));
        const cash = byMethod.find((row) => row.method === PaymentMethod.CASH);
        const changeGiven = roundAmount(parseFloat(sales.change_given));
        return {
            bills: Number(sales.bills),
            sales_total: roundAmount(parseFloat(sales.total)),
            discounts: roundAmount(parseFloat(sales.discounts)),
            tax: roundAmount(parseFloat(sales.tax)),
            change_given: changeGiven,
            returns: refunds.reduce((sum, row) => sum + Number(row.count), 0),
            refunds_total: roundAmount(refunds.reduce((sum, row) => sum + parseFloat(row.amount), 0)),
            payments: byMethod,
            net_cash: roundAmount(cash.collected - changeGiven - cash.refunded),
        };
    }

    async sessionSummary(actor: AuthActor, id: number, canManage: boolean) {
        const session = await this.accessibleSession(actor, id, canManage);
        const totals = await this.sessionTotals(session.id);
        const expectedCash = session.status === RegisterSessionStatus.CLOSED
            ? session.expected_cash
            : roundAmount(session.opening_cash + totals.net_cash);
        return { ...session, totals, expected_cash: expectedCash };
    }

    async closeSession(actor: AuthActor, id: number, body: CloseRegisterDto, canManage: boolean) {
        const session = await this.accessibleSession(actor, id, canManage);
        if (session.status !== RegisterSessionStatus.OPEN) {
            throw new BadRequestException('This register is already closed');
        }
        const totals = await this.sessionTotals(session.id);
        const expectedCash = roundAmount(session.opening_cash + totals.net_cash);
        const closingCash = roundAmount(body.closing_cash);
        await this.dataSource.transaction(async (manager) => {
            await manager.update(RegisterSession, session.id, {
                status: RegisterSessionStatus.CLOSED,
                expected_cash: expectedCash,
                closing_cash: closingCash,
                cash_difference: roundAmount(closingCash - expectedCash),
                note: [session.note, body.note].filter(Boolean).join('\n') || null,
                closed_at: new Date(),
            });
            // The counted cash stays in the drawer and becomes the next counter's opening cash.
            await manager.update(Clientstore, session.clientstore_id, { drawer_cash: closingCash });
        });
        return this.sessionSummary(actor, session.id, canManage);
    }

    priceLines(lines: SaleLineDto[], variants: Map<number, ProductVariant>, billDiscount: number) {
        const priced = lines.map((line) => {
            const variant = variants.get(Number(line.product_variant_id));
            const product = variant.product;
            const label = `${product.name} (${variant.name})`;
            if (!variant.is_active || !product.is_active) {
                throw new BadRequestException(`${label} is not available for sale`);
            }
            const quantity = roundQuantity(line.quantity);
            if (!product.is_weighted && !Number.isInteger(quantity)) {
                throw new BadRequestException(`${label} is sold in whole units`);
            }
            const gross = roundAmount(quantity * variant.sale_price);
            const discount = roundAmount(line.discount_amount || 0);
            if (discount > gross) {
                throw new BadRequestException(`${label}: discount is more than the line amount`);
            }
            return {
                variant,
                quantity,
                unit_price: variant.sale_price,
                gross,
                discount_amount: discount,
                bill_discount_share: 0,
                tax_rate: product.tax?.is_active === false ? 0 : Number(product.tax?.rate || 0),
                price_includes_tax: product.price_includes_tax,
                tax_amount: 0,
                line_total: 0,
            } as PricedSaleLine;
        });
        const netTotal = roundAmount(priced.reduce((sum, line) => sum + line.gross - line.discount_amount, 0));
        const discount = roundAmount(billDiscount || 0);
        if (discount > netTotal) {
            throw new BadRequestException('Bill discount is more than the bill amount');
        }
        let allocated = 0;
        priced.forEach((line, index) => {
            const net = line.gross - line.discount_amount;
            const share = index === priced.length - 1
                ? roundAmount(discount - allocated)
                : netTotal > 0 ? roundAmount(discount * net / netTotal) : 0;
            allocated = roundAmount(allocated + share);
            const taxable = roundAmount(net - share);
            line.bill_discount_share = share;
            if (line.price_includes_tax) {
                line.tax_amount = roundAmount(taxable * line.tax_rate / (100 + line.tax_rate));
                line.line_total = taxable;
            } else {
                line.tax_amount = roundAmount(taxable * line.tax_rate / 100);
                line.line_total = roundAmount(taxable + line.tax_amount);
            }
        });
        return {
            lines: priced,
            item_count: roundQuantity(priced.reduce((sum, line) => sum + line.quantity, 0)),
            subtotal: roundAmount(priced.reduce((sum, line) => sum + line.gross, 0)),
            item_discount: roundAmount(priced.reduce((sum, line) => sum + line.discount_amount, 0)),
            bill_discount: discount,
            tax_amount: roundAmount(priced.reduce((sum, line) => sum + line.tax_amount, 0)),
            total_amount: roundAmount(priced.reduce((sum, line) => sum + line.line_total, 0)),
        };
    }

    async quote(actor: AuthActor, body: SaleCreateDto) {
        const store = await this.resolveStore(actor, body.clientstore_id);
        const variants = await this.productService.variantsForVendor(store.vendor_id, body.items.map((item) => item.product_variant_id));
        const priced = this.priceLines(body.items, variants, body.bill_discount);
        return { ...priced, lines: priced.lines.map(({ variant, ...line }) => ({ ...line, product_variant_id: variant.id })) };
    }

    private checkPayments(total: number, payments: { method: PaymentMethod; amount: number }[]) {
        const paid = roundAmount(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
        if (paid < total) {
            throw new BadRequestException(`Payment is short by ${roundAmount(total - paid)}`);
        }
        const nonCash = roundAmount(payments.filter((payment) => payment.method !== PaymentMethod.CASH).reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
        if (nonCash > total) {
            throw new BadRequestException('Card and online payments cannot be more than the bill. Only cash can have change.');
        }
        return { paid, change: roundAmount(paid - total) };
    }

    private async cardBanks(vendorId: number, payments: { method: PaymentMethod; bank_id?: number }[]) {
        const cards = payments.filter((payment) => payment.method === PaymentMethod.CARD);
        if (cards.some((payment) => !payment.bank_id)) {
            throw new BadRequestException('Select the bank for every card payment');
        }
        const ids = [...new Set(cards.map((payment) => Number(payment.bank_id)))];
        const banks = ids.length
            ? await this.dataSource.getRepository(Bank).find({ where: { id: In(ids), vendor: { id: vendorId }, is_active: true } })
            : [];
        if (banks.length !== ids.length) {
            throw new BadRequestException('The selected bank is not valid');
        }
        return new Map(banks.map((bank) => [bank.id, bank]));
    }

    private async resolveCustomer(manager: EntityManager, vendorId: number, body: SaleCreateDto) {
        if (body.user_id) {
            const user = await manager.findOne(User, { where: { id: body.user_id } });
            if (!user || user.vendor_id !== vendorId) {
                throw new BadRequestException('The selected customer is not valid');
            }
            return user;
        }
        const phone = body.customer_phone?.trim();
        if (!phone) {
            return null;
        }
        const existing = await manager.findOne(User, { where: { phone, vendor: { id: vendorId } } });
        if (existing) {
            return existing;
        }
        if (!body.customer_name?.trim()) {
            return null;
        }
        return manager.save(User, {
            full_name: body.customer_name.trim(),
            phone,
            vendor: { id: vendorId },
            is_active: true,
        });
    }

    async createSale(actor: AuthActor, body: SaleCreateDto) {
        const store = await this.resolveStore(actor, body.clientstore_id);
        if (!store.is_pos_active) {
            throw new BadRequestException(`POS is not enabled for ${store.store_name}`);
        }
        const session = await this.currentSession(actor, store.id);
        if (!session) {
            throw new BadRequestException('Open the register before billing');
        }
        const variants = await this.productService.variantsForVendor(store.vendor_id, body.items.map((item) => item.product_variant_id));
        const priced = this.priceLines(body.items, variants, body.bill_discount);
        const payments = body.payments.filter((payment) => Number(payment.amount) > 0);
        const { paid, change } = this.checkPayments(priced.total_amount, payments);
        const banks = await this.cardBanks(store.vendor_id, payments);

        const saleId = await this.dataSource.transaction(async (manager) => {
            const allowNegative = await this.stockService.allowNegativeStock(manager, store.vendor_id);
            const customer = await this.resolveCustomer(manager, store.vendor_id, body);
            const sale = await manager.save(Sale, {
                vendor: { id: store.vendor_id },
                clientstore: { id: store.id },
                register_session: { id: session.id },
                cashier: { id: actor.id },
                customer: customer ? { id: customer.id } : null,
                customer_name: customer?.full_name || body.customer_name?.trim() || null,
                customer_phone: customer?.phone || body.customer_phone?.trim() || null,
                status: SaleStatus.COMPLETED,
                item_count: priced.item_count,
                subtotal: priced.subtotal,
                item_discount: priced.item_discount,
                bill_discount: priced.bill_discount,
                tax_amount: priced.tax_amount,
                total_amount: priced.total_amount,
                paid_amount: paid,
                change_amount: change,
                note: body.note || null,
            });
            const billNumber = documentNumber(store.store_code.toUpperCase(), sale.id);
            let cost = 0;
            for (const line of priced.lines) {
                const variant = line.variant;
                const movement = await this.stockService.applyMovement(manager, {
                    vendorId: store.vendor_id,
                    clientstoreId: store.id,
                    variantId: variant.id,
                    type: StockMovementType.SALE,
                    quantity: line.quantity,
                    allowNegative,
                    label: `${variant.product.name} (${variant.name})`,
                    reference: { type: 'sale', id: sale.id, number: billNumber },
                    createdById: actor.id,
                });
                cost += line.quantity * movement.unitCost;
                await manager.save(SaleItem, {
                    sale: { id: sale.id },
                    product_variant: { id: variant.id },
                    product_name: variant.product.name,
                    variant_name: variant.name,
                    sku: variant.sku,
                    unit_label: variant.product.is_weighted ? variant.product.unit?.short_name : null,
                    quantity: line.quantity,
                    unit_price: line.unit_price,
                    discount_amount: line.discount_amount,
                    bill_discount_share: line.bill_discount_share,
                    tax_rate: line.tax_rate,
                    price_includes_tax: line.price_includes_tax,
                    tax_amount: line.tax_amount,
                    line_total: line.line_total,
                    unit_cost: movement.unitCost,
                });
            }
            await manager.save(SalePayment, payments.map((payment) => ({
                sale: { id: sale.id },
                method: payment.method,
                amount: roundAmount(payment.amount),
                reference: payment.reference || null,
                bank: payment.method === PaymentMethod.CARD ? { id: Number(payment.bank_id) } : null,
                bank_name: payment.method === PaymentMethod.CARD ? banks.get(Number(payment.bank_id)).name : null,
            })));
            await manager.update(Sale, sale.id, { bill_number: billNumber, cost_amount: roundAmount(cost) });
            return sale.id;
        });
        return this.findSale(actor, saleId);
    }

    async findSale(actor: AuthActor, id: number) {
        const sale = await this.saleRepository.findOne({ where: { id }, relations: this.saleRelations });
        if (!sale) {
            throw new NotFoundException('Bill not found');
        }
        assertStoreDocumentAccess(actor, sale.vendor_id, [sale.clientstore_id]);
        const returns = await this.returnRepository.find({
            where: { sale: { id: sale.id } },
            relations: ['items', 'processed_by'],
            order: { id: 'ASC' },
        });
        return { ...sale, returns };
    }

    async returnSale(actor: AuthActor, saleId: number, body: SaleReturnDto) {
        const found = await this.findSale(actor, saleId);
        const session = await this.currentSession(actor, found.clientstore_id);
        if (!session) {
            throw new BadRequestException('Open the register at this store before processing a return');
        }
        const returnId = await this.dataSource.transaction(async (manager) => {
            const sale = await manager
                .createQueryBuilder(Sale, 'sale')
                .setLock('pessimistic_write')
                .where('sale.id = :saleId', { saleId })
                .getOne();
            if (sale.status === SaleStatus.RETURNED) {
                throw new BadRequestException('Everything on this bill has already been returned');
            }
            const items = await manager.find(SaleItem, { where: { sale: { id: sale.id } } });
            const saleReturn = await manager.save(SaleReturn, {
                sale: { id: sale.id },
                vendor: { id: sale.vendor_id },
                clientstore: { id: sale.clientstore_id },
                register_session: { id: session.id },
                processed_by: { id: actor.id },
                refund_method: body.refund_method,
                reason: body.reason,
            });
            const returnNumber = documentNumber('RET', saleReturn.id);
            let refund = 0;
            const requested = new Map<number, number>();
            body.items.forEach((line) => requested.set(Number(line.sale_item_id), roundQuantity((requested.get(Number(line.sale_item_id)) || 0) + line.quantity)));
            for (const [saleItemId, quantity] of requested) {
                const item = items.find((row) => row.id === saleItemId);
                if (!item) {
                    throw new BadRequestException('A returned line does not belong to this bill');
                }
                const returnable = roundQuantity(item.quantity - item.returned_quantity);
                if (quantity > returnable) {
                    throw new BadRequestException(`${item.product_name} (${item.variant_name}): only ${returnable} can still be returned`);
                }
                const lineRefund = roundAmount(item.line_total * quantity / item.quantity);
                refund += lineRefund;
                await this.stockService.applyMovement(manager, {
                    vendorId: sale.vendor_id,
                    clientstoreId: sale.clientstore_id,
                    variantId: item.product_variant_id,
                    type: StockMovementType.SALE_RETURN,
                    quantity,
                    unitCost: item.unit_cost,
                    allowNegative: true,
                    label: item.product_name,
                    reference: { type: 'sale_return', id: saleReturn.id, number: returnNumber },
                    note: body.reason,
                    createdById: actor.id,
                });
                await manager.update(SaleItem, item.id, { returned_quantity: roundQuantity(item.returned_quantity + quantity) });
                item.returned_quantity = roundQuantity(item.returned_quantity + quantity);
                await manager.save(SaleReturnItem, {
                    sale_return: { id: saleReturn.id },
                    sale_item: { id: item.id },
                    quantity,
                    refund_amount: lineRefund,
                });
            }
            refund = roundAmount(refund);
            const fullyReturned = items.every((item) => roundQuantity(item.returned_quantity) >= roundQuantity(item.quantity));
            await manager.update(SaleReturn, saleReturn.id, { return_number: returnNumber, refund_amount: refund });
            await manager.update(Sale, sale.id, {
                refunded_amount: roundAmount(sale.refunded_amount + refund),
                status: fullyReturned ? SaleStatus.RETURNED : SaleStatus.PARTIALLY_RETURNED,
            });
            return saleReturn.id;
        });
        const saleReturn = await this.returnRepository.findOne({ where: { id: returnId }, relations: ['items'] });
        return { sale: await this.findSale(actor, saleId), return: saleReturn };
    }

    async scan(actor: AuthActor, code: string, clientstoreId: number) {
        const store = await this.resolveStore(actor, clientstoreId);
        const clean = code.trim();
        const [exact] = await this.productService.searchVariants(store.vendor_id, clean, store.id, 1, true);
        if (exact) {
            return { variant: exact, quantity: exact.is_weighted ? null : 1, source: 'barcode' };
        }
        if (/^2\d{12}$/.test(clean)) {
            const plu = clean.substring(1, 7);
            const candidates = [plu, String(Number(plu))];
            for (const candidate of candidates) {
                const [weighted] = await this.productService.searchVariants(store.vendor_id, candidate, store.id, 1, true);
                if (weighted && weighted.is_weighted) {
                    const grams = Number(clean.substring(7, 12));
                    return { variant: weighted, quantity: roundQuantity(grams / 1000), source: 'weight-barcode' };
                }
            }
        }
        throw new NotFoundException(`No product found for barcode ${clean}`);
    }

    async lookupCustomers(actor: AuthActor, term: string) {
        if (!term || term.trim().length < 3) {
            return [];
        }
        return this.userRepository
            .createQueryBuilder('user')
            .select(['user.id', 'user.full_name', 'user.phone', 'user.email', 'user.loyalty_points'])
            .where('user.vendor_id = :vendorId', { vendorId: actor.vendor_id })
            .andWhere('user.is_active = 1')
            .andWhere('(user.phone LIKE :term OR user.full_name LIKE :term)', { term: `%${term.trim()}%` })
            .orderBy('user.full_name', 'ASC')
            .limit(8)
            .getMany();
    }

    async markPrinted(id: number) {
        await this.saleRepository.increment({ id }, 'print_count', 1);
    }

    formatTime(date: Date, timeZone?: string) {
        return moment(date).tz(timeZone || 'Asia/Karachi').format('DD MMM YYYY hh:mm A');
    }
}
