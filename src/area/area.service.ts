import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { Area } from './models/area.entity';

@Injectable()
export class AreaService extends AbstractService {
    constructor(
        @InjectRepository(Area, 'MainConnection') private readonly areaRepository: Repository<Area>
    ) {
        super(areaRepository);
    }
}
