import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AbstractService } from 'src/common/abstract.service';
import { Client, ClientType } from 'src/client/models/client.entity';
import { Role, RoleType } from 'src/role/role.entity';
import { Vendor } from './models/vendor.entity';
import { VendorCreateDto } from './models/vendor.dto';

@Injectable()
export class VendorService extends AbstractService {
    constructor(
        @InjectRepository(Vendor, 'MainConnection') private readonly vendorRepository: Repository<Vendor>,
        @InjectDataSource('MainConnection') private readonly dataSource: DataSource,
    ) {
        super(vendorRepository);
    }

    async createWithOwner(body: VendorCreateDto): Promise<Vendor> {
        const { owner, country_id, city_id, ...data } = body;
        return this.dataSource.transaction(async (manager) => {
            const ownerRole = await manager.findOne(Role, { where: { name: 'Owner', type: RoleType.VENDOR, is_system: true, vendor: IsNull() } });
            if (!ownerRole) {
                throw new BadRequestException('Owner role is missing. Run the seed script first.');
            }
            const existingClient = await manager.findOne(Client, { where: [{ email: owner.email }, { phone: owner.phone }], withDeleted: true });
            if (existingClient) {
                throw new BadRequestException('Owner email or phone is already used by another account');
            }
            const vendor = await manager.save(Vendor, {
                ...data,
                owner_name: data.owner_name || owner.full_name,
                country: { id: country_id },
                city: city_id ? { id: city_id } : null,
            });
            await manager.save(Client, {
                client_type: ClientType.OWNER,
                full_name: owner.full_name,
                email: owner.email,
                phone: owner.phone,
                password: await bcrypt.hash(owner.password, 12),
                is_active: true,
                vendor: { id: vendor.id },
                role: { id: ownerRole.id },
                country: { id: country_id },
                city: city_id ? { id: city_id } : null,
            });
            return vendor;
        });
    }
}
