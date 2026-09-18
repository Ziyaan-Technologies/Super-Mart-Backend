import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { ActorType, AuthActor } from 'src/common/auth-actor';
import { Clientstore } from './models/clientstore.entity';

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
}
