import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { Unit } from './models/unit.entity';

@Injectable()
export class UnitService extends AbstractService {
    constructor(
        @InjectRepository(Unit, 'MainConnection') private readonly unitRepository: Repository<Unit>
    ) {
        super(unitRepository);
    }

    async usageCount(id: number): Promise<number> {
        const [{ total }] = await this.unitRepository.query('SELECT COUNT(*) AS total FROM products WHERE unit_id = ? AND deleted_at IS NULL', [id]);
        return Number(total);
    }
}
