import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { City } from './models/city.entity';

@Injectable()
export class CityService extends AbstractService {
    constructor(
        @InjectRepository(City, 'MainConnection') private readonly cityRepository: Repository<City>
    ) {
        super(cityRepository);
    }
}
