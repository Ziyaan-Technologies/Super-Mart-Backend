import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { Admin } from './models/admin.entity';

@Injectable()
export class AdminService extends AbstractService {
    constructor(
        @InjectRepository(Admin, 'MainConnection') private readonly adminRepository: Repository<Admin>
    ) {
        super(adminRepository);
    }
}
