import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Query, Res } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { DataSource, Repository } from 'typeorm';
import * as moment from 'moment-timezone';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';
import { requiredVendorId } from 'src/common/tenant-scope';
import { applyDocumentFilters, paginateQuery } from 'src/common/document-list';
import { roundAmount } from 'src/common/decimal.transformer';
import { ExportService } from 'src/common/export.service';
import { HasPermission } from 'src/permission/has-permission.decorator';
import { RoleService } from 'src/role/role.service';
import { CategoryService } from 'src/category/category.service';
import { ProductService } from 'src/product/product.service';
import { PosService } from './pos.service';
import { ReceiptService } from './receipt.service';
import { RegisterSession } from './models/register-session.entity';
import { Sale } from './models/sale.entity';
import { CloseRegisterDto, OpenRegisterDto, RegisterListDto, SaleCreateDto, SaleListDto, SaleReturnDto } from './models/pos.dto';

@ActorTypes(ActorType.CLIENT)
@Controller('pos')
export class PosController {
    constructor(
        private posService: PosService,
        private receiptService: ReceiptService,
        private roleService: RoleService,
        private categoryService: CategoryService,
        private productService: ProductService,
        private exportService: ExportService,
        @InjectRepository(Sale, 'MainConnection') private readonly saleRepository: Repository<Sale>,
        @InjectRepository(RegisterSession, 'MainConnection') private readonly sessionRepository: Repository<RegisterSession>,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
    ) { }

    private async can(actor: AuthActor, key: string) {
        return (await this.roleService.permissionKeys(actor.role_id)).has(key);
    }

    @HasPermission('pos_sell')
    @Get('registers/current')
    async currentRegister(@Actor() actor: AuthActor, @Query('clientstore_id') clientstoreId?: number) {
        const store = await this.posService.resolveStore(actor, clientstoreId);
        const session = await this.posService.currentSession(actor);
        if (!session) {
            return { session: null };
        }
        if (session.clientstore_id !== store.id) {
            return { session: null, open_elsewhere: session.clientstore?.store_name };
        }
        return { session: await this.posService.sessionSummary(actor, session.id, false) };
    }

    @HasPermission('pos_sell')
    @Post('registers/open')
    async openRegister(@Actor() actor: AuthActor, @Body() body: OpenRegisterDto) {
        return this.posService.openSession(actor, body);
    }

    private registerQuery(actor: AuthActor, body: RegisterListDto, canManage: boolean) {
        const query = this.sessionRepository
            .createQueryBuilder('register_session')
            .leftJoinAndSelect('register_session.clientstore', 'clientstore')
            .leftJoin('register_session.cashier', 'cashier')
            .addSelect(['cashier.id', 'cashier.full_name']);
        applyDocumentFilters(query, 'register_session', actor, {
            vendorId: requiredVendorId(actor),
            clientstoreId: body.clientstore_id,
            status: body.status,
            search: body.search,
            startDate: body.startDate,
            endDate: body.endDate,
        }, {
            storeColumns: ['clientstore_id'],
            dateColumn: 'opened_at',
            searchColumns: ['register_session.session_number', 'cashier.full_name'],
            timestampDate: true,
        });
        const cashierId = canManage ? body.cashier_id : actor.id;
        if (cashierId) {
            query.andWhere('register_session.cashier_id = :cashierId', { cashierId });
        }
        return query.orderBy('register_session.id', 'DESC');
    }

    @HasPermission('pos_sell', 'pos_manage')
    @Post('registers/v1/list')
    async registers(@Actor() actor: AuthActor, @Body() body: RegisterListDto) {
        const result = await paginateQuery(this.registerQuery(actor, body, await this.can(actor, 'pos_manage')), body.page || 1, body.take || 10);
        const data = [];
        for (const session of result.data) {
            data.push({ ...session, totals: await this.posService.sessionTotals(session.id) });
        }
        return { ...result, data };
    }

    @HasPermission('pos_sell', 'pos_manage')
    @Get('registers/:id')
    async register(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.posService.sessionSummary(actor, id, await this.can(actor, 'pos_manage'));
    }

    @HasPermission('pos_sell', 'pos_manage')
    @Post('registers/:id/close')
    async closeRegister(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: CloseRegisterDto) {
        return this.posService.closeSession(actor, id, body, await this.can(actor, 'pos_manage'));
    }

    @HasPermission('pos_sell')
    @Get('items')
    async items(
        @Actor() actor: AuthActor,
        @Query('clientstore_id') clientstoreId: number,
        @Query('category_id') categoryId?: number,
        @Query('q') term = '',
        @Query('page') page = 1,
        @Query('limit') limit = 24,
    ) {
        const store = await this.posService.resolveStore(actor, clientstoreId);
        const take = Math.min(Number(limit) || 24, 60);
        return this.productService.searchVariants(store.vendor_id, term.trim(), store.id, take, false, {
            categoryIds: categoryId ? await this.categoryService.descendantIds(categoryId) : null,
            offset: (Math.max(Number(page) || 1, 1) - 1) * take,
        });
    }

    @HasPermission('pos_sell')
    @Get('scan/:code')
    async scan(@Actor() actor: AuthActor, @Param('code') code: string, @Query('clientstore_id') clientstoreId: number) {
        return this.posService.scan(actor, code, clientstoreId);
    }

    @HasPermission('pos_sell')
    @Get('customers')
    async customers(@Actor() actor: AuthActor, @Query('q') term = '') {
        return this.posService.lookupCustomers(actor, term);
    }

    @HasPermission('pos_sell')
    @Post('sales/quote')
    async quote(@Actor() actor: AuthActor, @Body() body: SaleCreateDto) {
        return this.posService.quote(actor, body);
    }

    @HasPermission('pos_sell')
    @Post('sales')
    async createSale(@Actor() actor: AuthActor, @Body() body: SaleCreateDto) {
        const discounted = (body.bill_discount || 0) > 0 || body.items.some((item) => (item.discount_amount || 0) > 0);
        if (discounted && !(await this.can(actor, 'pos_discount'))) {
            throw new ForbiddenException('You are not allowed to give discounts');
        }
        return this.posService.createSale(actor, body);
    }

    private saleQuery(actor: AuthActor, body: SaleListDto, ownOnly: boolean) {
        const query = this.saleRepository
            .createQueryBuilder('sale')
            .leftJoinAndSelect('sale.clientstore', 'clientstore')
            .leftJoin('sale.cashier', 'cashier')
            .addSelect(['cashier.id', 'cashier.full_name']);
        applyDocumentFilters(query, 'sale', actor, {
            vendorId: requiredVendorId(actor),
            clientstoreId: body.clientstore_id,
            status: body.status,
            search: body.search,
            startDate: body.startDate,
            endDate: body.endDate,
        }, {
            storeColumns: ['clientstore_id'],
            dateColumn: 'created_at',
            searchColumns: ['sale.bill_number', 'sale.customer_name', 'sale.customer_phone'],
            timestampDate: true,
        });
        const cashierId = ownOnly ? actor.id : body.cashier_id;
        if (cashierId) {
            query.andWhere('sale.cashier_id = :cashierId', { cashierId });
        }
        if (body.register_session_id) {
            query.andWhere('sale.register_session_id = :sessionId', { sessionId: body.register_session_id });
        }
        return query.orderBy('sale.id', body.sortBy === 'Oldest' ? 'ASC' : 'DESC');
    }

    @HasPermission('pos_sell', 'sales_view')
    @Post('sales/v1/list')
    async sales(@Actor() actor: AuthActor, @Body() body: SaleListDto) {
        const ownOnly = !(await this.can(actor, 'sales_view'));
        const query = this.saleQuery(actor, body, ownOnly).leftJoinAndSelect('sale.payments', 'payment');
        return paginateQuery(query, body.page || 1, body.take || 10);
    }

    @HasPermission('pos_sell', 'sales_view')
    @Post('sales/v1/kpis')
    async salesKpis(@Actor() actor: AuthActor, @Body() body: SaleListDto) {
        const ownOnly = !(await this.can(actor, 'sales_view'));
        const [summary] = [await this.saleQuery(actor, body, ownOnly)
            .select('COUNT(*)', 'bills')
            .addSelect('COALESCE(SUM(sale.total_amount), 0)', 'gross')
            .addSelect('COALESCE(SUM(sale.refunded_amount), 0)', 'refunds')
            .addSelect('COALESCE(SUM(sale.tax_amount), 0)', 'tax')
            .addSelect('COALESCE(SUM(sale.item_discount + sale.bill_discount), 0)', 'discounts')
            .addSelect('COALESCE(SUM(sale.item_count), 0)', 'items')
            .orderBy()
            .getRawOne()];
        const profitQuery = this.saleQuery(actor, body, ownOnly)
            .innerJoin('sale.items', 'item')
            .select('COALESCE(SUM((item.line_total - item.tax_amount) * (item.quantity - item.returned_quantity) / item.quantity - item.unit_cost * (item.quantity - item.returned_quantity)), 0)', 'profit')
            .orderBy();
        const { profit } = await profitQuery.getRawOne();
        const payments = await this.saleQuery(actor, body, ownOnly)
            .innerJoin('sale.payments', 'payment')
            .select('payment.method', 'method')
            .addSelect('COALESCE(SUM(payment.amount), 0)', 'amount')
            .groupBy('payment.method')
            .orderBy()
            .getRawMany();
        const bills = Number(summary.bills);
        const gross = parseFloat(summary.gross);
        const refunds = parseFloat(summary.refunds);
        return {
            bills,
            grossSales: roundAmount(gross),
            refunds: roundAmount(refunds),
            netSales: roundAmount(gross - refunds),
            averageBill: bills ? roundAmount(gross / bills) : 0,
            tax: roundAmount(parseFloat(summary.tax)),
            discounts: roundAmount(parseFloat(summary.discounts)),
            itemsSold: parseFloat(summary.items),
            grossProfit: ownOnly ? null : roundAmount(parseFloat(profit)),
            payments: payments.map((row) => ({ method: row.method, amount: roundAmount(parseFloat(row.amount)) })),
        };
    }

    @HasPermission('pos_sell', 'sales_view')
    @Get('sales/lookup/:billNumber')
    async lookup(@Actor() actor: AuthActor, @Param('billNumber') billNumber: string) {
        const sale = await this.saleRepository.findOne({ where: { bill_number: billNumber.trim().toUpperCase(), vendor: { id: requiredVendorId(actor) } } });
        if (!sale) {
            throw new NotFoundException(`Bill ${billNumber} not found`);
        }
        return this.posService.findSale(actor, sale.id);
    }

    @HasPermission('pos_sell', 'sales_view')
    @Get('sales/:id')
    async sale(@Actor() actor: AuthActor, @Param('id') id: number) {
        return this.posService.findSale(actor, id);
    }

    @HasPermission('pos_sell', 'sales_view')
    @Get('sales/:id/receipt')
    async receipt(@Actor() actor: AuthActor, @Param('id') id: number, @Res() res: Response) {
        const sale = await this.posService.findSale(actor, id);
        this.receiptService.render(res, sale);
        await this.posService.markPrinted(sale.id);
    }

    @HasPermission('pos_return')
    @Post('sales/:id/return')
    async returnSale(@Actor() actor: AuthActor, @Param('id') id: number, @Body() body: SaleReturnDto) {
        return this.posService.returnSale(actor, id, body);
    }

    @HasPermission('sales_view')
    @Post('sales/export/:format')
    async export(@Actor() actor: AuthActor, @Param('format') format: string, @Body() body: SaleListDto, @Res() res: Response) {
        const rows = await this.saleQuery(actor, body, false).getMany();
        const columns = [
            { header: 'Bill', key: 'bill_number', width: 18 },
            { header: 'Date', key: 'created_at', width: 20, value: (row: any) => moment(row.created_at).format('YYYY-MM-DD HH:mm') },
            { header: 'Store', key: 'clientstore', width: 18, value: (row: any) => row.clientstore?.store_name },
            { header: 'Cashier', key: 'cashier', width: 18, value: (row: any) => row.cashier?.full_name },
            { header: 'Customer', key: 'customer_name', width: 18 },
            { header: 'Items', key: 'item_count', width: 8 },
            { header: 'Total', key: 'total_amount', width: 12 },
            { header: 'Refunded', key: 'refunded_amount', width: 12 },
            { header: 'Status', key: 'status', width: 16 },
        ];
        if (format === 'pdf') {
            return this.exportService.pdf(res, 'Sales', columns, rows);
        }
        return this.exportService.excel(res, 'Sales', columns, rows);
    }
}
