import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorScopedService } from 'src/common/vendor-scoped.service';
import { Supplier } from './models/supplier.entity';

@Injectable()
export class SupplierService extends VendorScopedService {
    protected readonly label = 'Supplier';

    constructor(
        @InjectRepository(Supplier, 'MainConnection') private readonly supplierRepository: Repository<Supplier>
    ) {
        super(supplierRepository);
    }

    async usageCount(id: number): Promise<number> {
        const [{ orders }] = await this.supplierRepository.query('SELECT COUNT(*) AS orders FROM purchase_orders WHERE supplier_id = ?', [id]);
        const [{ receipts }] = await this.supplierRepository.query('SELECT COUNT(*) AS receipts FROM goods_receipts WHERE supplier_id = ?', [id]);
        return Number(orders) + Number(receipts);
    }
}
