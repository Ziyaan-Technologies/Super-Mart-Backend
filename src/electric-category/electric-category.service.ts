import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ElectricNamedService } from 'src/common/electric-named.service';
import { ElectricAccessService } from 'src/electric-access/electric-access.service';
import { ElectricCategory } from './models/electric-category.entity';

@Injectable()
export class ElectricCategoryService extends ElectricNamedService {
    protected readonly label = 'Category';
    protected readonly alias = 'category';
    protected readonly productColumn = 'category_id';

    constructor(
        access: ElectricAccessService,
        @InjectRepository(ElectricCategory, 'MainConnection') repository: Repository<ElectricCategory>,
        @InjectDataSource('MainConnection') dataSource: DataSource,
    ) {
        super(access, repository, dataSource);
    }

    protected order(query: any) {
        return query.orderBy('category.id', 'DESC');
    }

    protected extraFields(body: any, current?: any) {
        if (body.sort_order === undefined) {
            return current ? {} : { sort_order: 0 };
        }
        return { sort_order: Number(body.sort_order) || 0 };
    }
}
