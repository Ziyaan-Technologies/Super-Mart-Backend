import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Not, Repository } from 'typeorm';
import { AbstractService } from './abstract.service';
import { ActorType, AuthActor } from './auth-actor';

export abstract class VendorScopedService extends AbstractService {
    protected abstract readonly label: string;

    protected constructor(repository: Repository<any>) {
        super(repository);
    }

    async accessible(actor: AuthActor, id: number, relations: string[] = []): Promise<any> {
        const record = await this.repository.findOne({ where: { id }, relations });
        if (!record) {
            throw new NotFoundException(`${this.label} not found`);
        }
        if (actor.type !== ActorType.ADMIN && record.vendor_id !== actor.vendor_id) {
            throw new ForbiddenException(`You do not have access to this ${this.label.toLowerCase()}`);
        }
        return record;
    }

    async assertOwnedByVendor(id: number, vendorId: number) {
        if (!id) {
            return null;
        }
        const record = await this.repository.findOne({ where: { id } });
        if (!record || record.vendor_id !== Number(vendorId)) {
            throw new BadRequestException(`The selected ${this.label.toLowerCase()} is not valid`);
        }
        return record;
    }

    async assertUniqueName(vendorId: number, name: string, exceptId?: number, field = 'name') {
        if (!name) {
            return;
        }
        const condition: any = { vendor: { id: vendorId }, [field]: name };
        if (exceptId) {
            condition.id = Not(exceptId);
        }
        if (await this.repository.findOne({ where: condition })) {
            throw new BadRequestException(`A ${this.label.toLowerCase()} named "${name}" already exists`);
        }
    }
}
