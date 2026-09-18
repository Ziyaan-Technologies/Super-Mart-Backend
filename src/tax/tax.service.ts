import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorScopedService } from 'src/common/vendor-scoped.service';
import { Tax } from './models/tax.entity';

@Injectable()
export class TaxService extends VendorScopedService {
    protected readonly label = 'Tax';

    constructor(
        @InjectRepository(Tax, 'MainConnection') private readonly taxRepository: Repository<Tax>
    ) {
        super(taxRepository);
    }

    async usageCount(id: number): Promise<number> {
        const [{ total }] = await this.taxRepository.query('SELECT COUNT(*) AS total FROM products WHERE tax_id = ? AND deleted_at IS NULL', [id]);
        return Number(total);
    }
}
