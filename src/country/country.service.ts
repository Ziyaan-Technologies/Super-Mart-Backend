import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { Country } from './models/country.entity';

@Injectable()
export class CountryService extends AbstractService {
    constructor(
        @InjectRepository(Country, 'MainConnection') private readonly countryRepository: Repository<Country>
    ) {
        super(countryRepository);
    }
}
