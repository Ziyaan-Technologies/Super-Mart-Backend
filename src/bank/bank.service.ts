import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorScopedService } from 'src/common/vendor-scoped.service';
import { Bank } from './models/bank.entity';

@Injectable()
export class BankService extends VendorScopedService {
    protected readonly label = 'Bank';

    constructor(
        @InjectRepository(Bank, 'MainConnection') private readonly bankRepository: Repository<Bank>
    ) {
        super(bankRepository);
    }
}
