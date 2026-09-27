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

    /** khata money you take or give yourself: your own open counter if you have one, otherwise no counter at all */
    async cashSession(actor: AuthActor, shopId: number, requestedId?: any) {
        const mine = await this.mySession(actor.id);
        if (mine && (!requestedId || Number(requestedId) === mine.id)) {
            return mine;
        }
        if (requestedId && (await this.can(actor, 'pos_any_counter'))) {
            const chosen = await this.sessionRepository.findOne({
                where: { id: Number(requestedId), status: ElectricSessionStatus.OPEN, clientstore: { id: shopId } },
            });
            if (chosen) {
                return chosen;
            }
        }
        return mine || null;
    }

    /** the session a sale, return or payment should land on: your own, or any open one with pos_any_counter */
    async sessionFor(actor: AuthActor, shopId: number, requestedId?: any) {
        const mine = await this.mySession(actor.id);
        if (mine && (!requestedId || Number(requestedId) === mine.id)) {
            return mine;
        }
        if (await this.can(actor, 'pos_any_counter')) {
            const where: any = { status: ElectricSessionStatus.OPEN, clientstore: { id: shopId } };
            if (requestedId) {
                where.id = Number(requestedId);
            }
            const any = await this.sessionRepository.findOne({ where, order: { id: 'ASC' } });
            if (any) {
                return any;
            }
        }
        return mine;
    }

    openSessions(shopId: number) {
        return this.sessionRepository.find({
            where: { status: ElectricSessionStatus.OPEN, clientstore: { id: shopId } },
            relations: ['counter', 'cashier'],
            order: { id: 'ASC' },
        });
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
