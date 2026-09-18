import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorScopedService } from 'src/common/vendor-scoped.service';
import { Brand } from './models/brand.entity';

@Injectable()
export class BrandService extends VendorScopedService {
    protected readonly label = 'Brand';

    constructor(
        @InjectRepository(Brand, 'MainConnection') private readonly brandRepository: Repository<Brand>
    ) {
        super(brandRepository);
    }

    async usageCount(id: number): Promise<number> {
        const [{ total }] = await this.brandRepository.query('SELECT COUNT(*) AS total FROM products WHERE brand_id = ? AND deleted_at IS NULL', [id]);
        return Number(total);
    }
}
