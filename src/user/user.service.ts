import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { AbstractService } from 'src/common/abstract.service';
import { ActorType, AuthActor } from 'src/common/auth-actor';
import { User } from './models/user.entity';

@Injectable()
export class UserService extends AbstractService {
    constructor(
        @InjectRepository(User, 'MainConnection') private readonly userRepository: Repository<User>
    ) {
        super(userRepository);
    }

    async accessible(actor: AuthActor, id: number, relations: string[] = []): Promise<User> {
        const user = await this.userRepository.findOne({ where: { id }, relations });
        if (!user) {
            throw new NotFoundException('Customer not found');
        }
        if (actor.type !== ActorType.ADMIN && user.vendor_id !== actor.vendor_id) {
            throw new ForbiddenException('You do not have access to this customer');
        }
        return user;
    }

    async assertUnique(vendorId: number, email?: string, phone?: string, exceptId?: number) {
        const conditions: any[] = [];
        if (email) conditions.push({ email, vendor: { id: vendorId } });
        if (phone) conditions.push({ phone, vendor: { id: vendorId } });
        if (!conditions.length) return;
        const existing = await this.userRepository.findOne({
            where: conditions.map((condition) => exceptId ? { ...condition, id: Not(exceptId) } : condition),
            withDeleted: true,
        });
        if (existing) {
            throw new BadRequestException(email && existing.email === email ? 'Email address already exists' : 'Phone number already exists');
        }
    }
}
