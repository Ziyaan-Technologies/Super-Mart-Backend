import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { ActorType, AuthActor } from 'src/common/auth-actor';
import { Clientstore, StoreType } from './models/clientstore.entity';

@Injectable()
export class ClientstoreService extends AbstractService {
    constructor(
        @InjectRepository(Clientstore, 'MainConnection') private readonly clientstoreRepository: Repository<Clientstore>
    ) {
        super(clientstoreRepository);
    }

    async accessible(actor: AuthActor, id: number, relations: string[] = []): Promise<Clientstore> {
        const clientstore = await this.clientstoreRepository.findOne({ where: { id }, relations });
        if (!clientstore) {
            throw new NotFoundException('Store not found');
        }
        if (actor.type !== ActorType.ADMIN) {
            if (clientstore.vendor_id !== actor.vendor_id) {
                throw new ForbiddenException('You do not have access to this store');
            }
            if (actor.clientstore_id && actor.clientstore_id !== clientstore.id) {
                throw new ForbiddenException('You do not have access to this store');
            }
        }
        return clientstore;
    }

    async assertBelongsToVendor(clientstoreId: number, vendorId: number): Promise<Clientstore> {
        const clientstore = await this.clientstoreRepository.findOne({ where: { id: clientstoreId } });
        if (!clientstore || clientstore.vendor_id !== Number(vendorId)) {
            throw new ForbiddenException('The selected store does not belong to this vendor');
        }
        return clientstore;
    }

    async warehouseFor(vendorId: number): Promise<Clientstore | null> {
        return this.clientstoreRepository.findOne({ where: { vendor: { id: vendorId }, store_type: StoreType.WAREHOUSE, is_active: true }, order: { id: 'ASC' } });
    }

    // Once a vendor has a warehouse, all supplier stock must land there first.
    async assertPurchaseStore(vendorId: number, clientstoreId: number) {
        const warehouse = await this.warehouseFor(vendorId);
        if (warehouse && warehouse.id !== Number(clientstoreId)) {
            throw new BadRequestException(`Purchases are received into ${warehouse.store_name}. Move stock to the Mart with a transfer.`);
        }
    }

    assertCanSell(clientstore: Clientstore) {
        if (clientstore.store_type === StoreType.WAREHOUSE) {
            throw new BadRequestException(`${clientstore.store_name} is a warehouse and cannot make sales. Switch to the Mart.`);
        }
    }
}
