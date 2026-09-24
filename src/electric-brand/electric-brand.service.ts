import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ElectricNamedService } from 'src/common/electric-named.service';
import { ElectricAccessService } from 'src/electric-access/electric-access.service';
import { ElectricBrand } from './models/electric-brand.entity';

@Injectable()
export class ElectricBrandService extends ElectricNamedService {
    protected readonly label = 'Brand';
    protected readonly alias = 'brand';
    protected readonly productColumn = 'brand_id';

    constructor(
        access: ElectricAccessService,
        @InjectRepository(ElectricBrand, 'MainConnection') repository: Repository<ElectricBrand>,
        @InjectDataSource('MainConnection') dataSource: DataSource,
    ) {
        super(access, repository, dataSource);
    }
}
