import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import * as moment from 'moment-timezone';
import { AuthActor } from 'src/common/auth-actor';
import { paginateQuery } from 'src/common/document-list';
import { roundAmount } from 'src/common/decimal.transformer';
import { ElectricListDto } from 'src/common/electric.dto';
import { brief, createQuotation, dayKey, quotationStatus, shopView, vendorView } from 'src/common/electric-document';
import { ElectricAccessService } from 'src/electric-access/electric-access.service';
import { ElectricSale } from 'src/electric-sale/models/electric-sale.entity';
import { ElectricQuotation, ElectricQuotationStatus } from './models/electric-quotation.entity';

@Injectable()
export class ElectricQuotationService {
    constructor(
        private access: ElectricAccessService,
        @InjectRepository(ElectricQuotation, 'MainConnection') private readonly quotationRepository: Repository<ElectricQuotation>,
        @InjectRepository(ElectricSale, 'MainConnection') private readonly saleRepository: Repository<ElectricSale>,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
    ) { }

    private dateRange(query: SelectQueryBuilder<any>, alias: string, body: ElectricListDto) {
        if (body.startDate) query.andWhere(`${alias}.created_at >= :startDate`, { startDate: moment(body.startDate).startOf('day').toDate() });
        const end = body.endDate || body.startDate;
        if (end) query.andWhere(`${alias}.created_at <= :endDate`, { endDate: moment(end).endOf('day').toDate() });
    }

    openCount(shopId: number) {
        return this.quotationRepository.createQueryBuilder('quotation')
            .where('quotation.clientstore_id = :shopId AND quotation.status = :open AND quotation.valid_until >= :today', { shopId, open: ElectricQuotationStatus.OPEN, today: dayKey() })
            .getCount();
    }

    quotationView(quotation: ElectricQuotation, saleNumber?: string | null) {
        const { created_by_client, counter, clientstore, vendor, ...rest } = quotation as any;
        const items = [...(quotation.items || [])].sort((a, b) => a.id - b.id);
        return {
            ...rest,
            items,
            status: quotationStatus(quotation),
            counter: counter ? { id: counter.id, name: counter.name } : null,
            created_by_user: brief(created_by_client),
            clientstore: shopView(clientstore),
            vendor: vendorView(vendor),
            sale: quotation.sale_id ? { id: quotation.sale_id, bill_number: saleNumber || null } : null,
            item_count: roundAmount(items.reduce((sum, item) => sum + item.quantity, 0)),
        };
    }

    private quotationRelations = ['items', 'created_by_client', 'counter', 'clientstore', 'vendor', 'vendor.country'];

    private async withSaleNumbers(quotations: ElectricQuotation[]) {
        const ids = quotations.map((quotation) => quotation.sale_id).filter(Boolean);
        const sales = ids.length ? await this.saleRepository.createQueryBuilder('sale').select(['sale.id', 'sale.bill_number']).where('sale.id IN (:...ids)', { ids }).getMany() : [];
        return quotations.map((quotation) => this.quotationView(quotation, sales.find((sale) => sale.id === quotation.sale_id)?.bill_number));
    }

    async seeQuotation(actor: AuthActor, id: number) {
        const quotation = await this.quotationRepository.findOne({ where: { id }, relations: this.quotationRelations });
        if (!quotation) throw new NotFoundException('Quotation not found');
        await this.access.shop(actor, quotation.clientstore_id);
        if (!(await this.access.counterAllowed(actor, quotation.counter_id))) {
            throw new ForbiddenException('This quotation belongs to another counter');
        }
        return quotation;
    }

    async quotation(actor: AuthActor, id: number) {
        await this.access.need(actor, 'quotations_view');
        return (await this.withSaleNumbers([await this.seeQuotation(actor, id)]))[0];
    }

    async createQuotation(actor: AuthActor, body: any) {
        await this.access.need(actor, 'quotations_create', 'You cannot make quotations');
        const shop = await this.access.shop(actor, body.clientstore_id);
        const granted = await this.access.granted(actor);
        const record = await this.access.record(actor);
        const id = await this.dataSource.transaction((manager) => createQuotation(manager, record, { ...body, clientstore_id: shop.id }, { granted }));
        return this.quotation(actor, id);
    }

    async listQuotations(actor: AuthActor, body: ElectricListDto) {
        await this.access.need(actor, 'quotations_view');
        const shop = await this.access.shop(actor, body.clientstore_id);
        const own = await this.access.ownCounterId(actor);
        const today = dayKey();
        const query = this.quotationRepository.createQueryBuilder('quotation')
            .leftJoinAndSelect('quotation.items', 'item')
            .leftJoinAndSelect('quotation.created_by_client', 'created_by_client')
            .leftJoinAndSelect('quotation.counter', 'counter')
            .where('quotation.clientstore_id = :shopId', { shopId: shop.id });
        if (own !== null) query.andWhere('quotation.counter_id = :own', { own });
        if (body.counter_id) query.andWhere('quotation.counter_id = :counterId', { counterId: Number(body.counter_id) });
        if (body.status === 'Expired') query.andWhere('quotation.status = :open AND quotation.valid_until < :today', { open: ElectricQuotationStatus.OPEN, today });
        if (body.status === 'Open') query.andWhere('quotation.status = :open AND quotation.valid_until >= :today', { open: ElectricQuotationStatus.OPEN, today });
        if (body.status === 'Converted') query.andWhere('quotation.status = :converted', { converted: ElectricQuotationStatus.CONVERTED });
        this.dateRange(query, 'quotation', body);
        if (body.search) {
            query.andWhere('(quotation.quotation_number LIKE :search OR quotation.customer_name LIKE :search OR quotation.customer_phone LIKE :search)', { search: `%${body.search}%` });
        }
        const result = await paginateQuery(query.orderBy('quotation.id', 'DESC'), Number(body.page) || 1, Number(body.take) || 10);
        return { ...result, data: await this.withSaleNumbers(result.data) };
    }
}
