import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthActor } from 'src/common/auth-actor';
import { ElectricActor } from 'src/common/electric-document';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { Client } from 'src/client/models/client.entity';
import { PermissionType } from 'src/permission/permission.entity';
import { RoleService } from 'src/role/role.service';
import { ElectricCounterSession, ElectricSessionStatus } from 'src/electric-counter/models/electric-counter-session.entity';

@Injectable()
export class ElectricAccessService {
    constructor(
        private roleService: RoleService,
        @InjectRepository(Clientstore, 'MainConnection') private readonly shopRepository: Repository<Clientstore>,
        @InjectRepository(Client, 'MainConnection') private readonly clientRepository: Repository<Client>,
        @InjectRepository(ElectricCounterSession, 'MainConnection') private readonly sessionRepository: Repository<ElectricCounterSession>,
    ) { }

    granted(actor: AuthActor) {
        return this.roleService.permissionKeys(actor.role_id, [PermissionType.ELECTRIC]);
    }

    async can(actor: AuthActor, key: string) {
        return (await this.granted(actor)).has(key);
    }

    async need(actor: AuthActor, key: string, message = 'You do not have permission to do this') {
        if (!(await this.can(actor, key))) {
            throw new ForbiddenException(message);
        }
    }

    async shops(actor: AuthActor) {
        const where: any = { vendor: { id: actor.vendor_id }, is_active: true };
        if (actor.clientstore_id) {
            where.id = actor.clientstore_id;
        }
        return this.shopRepository.find({ where, order: { store_name: 'ASC' } });
    }

    async shop(actor: AuthActor, id: any) {
        const shopId = Number(id);
        if (!shopId) {
            throw new BadRequestException('Select a shop first');
        }
        const shop = await this.shopRepository.findOne({ where: { id: shopId, vendor: { id: actor.vendor_id } }, relations: ['vendor', 'vendor.country'] });
        if (!shop || (actor.clientstore_id && actor.clientstore_id !== shop.id)) {
            throw new ForbiddenException('You cannot open this shop');
        }
        return shop;
    }

    async record(actor: AuthActor): Promise<ElectricActor> {
        const client = await this.clientRepository.findOne({ where: { id: actor.id } });
        return { id: actor.id, vendor_id: actor.vendor_id, electric_counter_id: client?.electric_counter_id || null };
    }

    mySession(actorId: number) {
        return this.sessionRepository.findOne({ where: { cashier: { id: actorId }, status: ElectricSessionStatus.OPEN } });
    }

    async ownCounterId(actor: AuthActor) {
        if (await this.can(actor, 'counters_all_documents')) {
            return null;
        }
        const record = await this.record(actor);
        if (record.electric_counter_id) {
            return record.electric_counter_id;
        }
        return (await this.mySession(actor.id))?.counter_id || -1;
    }

    async counterAllowed(actor: AuthActor, counterId: number | null) {
        const own = await this.ownCounterId(actor);
        return own === null || own === counterId;
    }
}
