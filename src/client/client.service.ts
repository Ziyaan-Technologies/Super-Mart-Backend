import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { ActorType, AuthActor } from 'src/common/auth-actor';
import { Role, RoleType } from 'src/role/role.entity';
import { Client, ClientType } from './models/client.entity';

@Injectable()
export class ClientService extends AbstractService {
    constructor(
        @InjectRepository(Client, 'MainConnection') private readonly clientRepository: Repository<Client>,
        @InjectRepository(Role, 'MainConnection') private readonly roleRepository: Repository<Role>,
    ) {
        super(clientRepository);
    }

    async accessible(actor: AuthActor, id: number, relations: string[] = []): Promise<Client> {
        const client = await this.clientRepository.findOne({ where: { id }, relations });
        if (!client) {
            throw new NotFoundException('Account not found');
        }
        if (actor.type === ActorType.CLIENT) {
            if (client.vendor_id !== actor.vendor_id) {
                throw new ForbiddenException('You do not have access to this account');
            }
            if (actor.clientstore_id && client.clientstore_id !== actor.clientstore_id) {
                throw new ForbiddenException('You do not have access to this account');
            }
        }
        return client;
    }

    async assertVendorRole(roleId: number, vendorId: number) {
        const role = await this.roleRepository.findOne({
            where: [
                { id: roleId, type: RoleType.VENDOR, vendor: { id: vendorId } },
                { id: roleId, type: RoleType.VENDOR, vendor: IsNull() },
            ],
        });
        if (!role) {
            throw new BadRequestException('Please choose a valid role for this vendor');
        }
        return role;
    }

    async assertUnique(email?: string, phone?: string, exceptId?: number) {
        const conditions: any[] = [];
        if (email) conditions.push({ email });
        if (phone) conditions.push({ phone });
        if (!conditions.length) return;
        const existing = await this.clientRepository.findOne({
            where: conditions.map((condition) => exceptId ? { ...condition, id: Not(exceptId) } : condition),
            withDeleted: true,
        });
        if (existing) {
            throw new BadRequestException(existing.email === email ? 'Email address already exists' : 'Phone number already exists');
        }
    }

    isOwner(client: Client) {
        return client.client_type === ClientType.OWNER;
    }
}
