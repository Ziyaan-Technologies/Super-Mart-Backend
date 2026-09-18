import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ActorType, AuthActor } from 'src/common/auth-actor';
import { Admin } from 'src/admin/models/admin.entity';
import { Client } from 'src/client/models/client.entity';
import { User } from 'src/user/models/user.entity';

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        @InjectRepository(Admin, 'MainConnection') private readonly adminRepository: Repository<Admin>,
        @InjectRepository(Client, 'MainConnection') private readonly clientRepository: Repository<Client>,
        @InjectRepository(User, 'MainConnection') private readonly userRepository: Repository<User>,
    ) {
    }

    extractToken(request: Request): string | null {
        const header = request.headers.authorization;
        if (header && header.startsWith('Bearer ')) {
            return header.slice(7);
        }
        return request.cookies?.jwt || null;
    }

    repositoryFor(type: ActorType): Repository<any> {
        if (type === ActorType.ADMIN) {
            return this.adminRepository;
        }
        if (type === ActorType.CLIENT) {
            return this.clientRepository;
        }
        return this.userRepository;
    }

    async resolveActor(token: string): Promise<AuthActor> {
        let payload: any;
        try {
            payload = await this.jwtService.verifyAsync(token);
        } catch (e) {
            throw new UnauthorizedException('Invalid or expired token');
        }
        const type: ActorType = payload.type;
        if (!Object.values(ActorType).includes(type)) {
            throw new UnauthorizedException('Invalid token');
        }
        const query = this.repositoryFor(type)
            .createQueryBuilder('account')
            .addSelect('account.token_version')
            .where('account.id = :id', { id: payload.id });
        if (type !== ActorType.ADMIN) {
            query.leftJoin('account.vendor', 'vendor').addSelect(['vendor.id', 'vendor.is_active']);
        }
        const account = await query.getOne();
        if (!account || account.token_version !== payload.ver) {
            throw new UnauthorizedException('Your session has ended. Please log in again.');
        }
        if (!account.is_active || (type !== ActorType.ADMIN && !account.vendor?.is_active)) {
            throw new ForbiddenException('Your account is not active. Please contact support.');
        }
        return {
            id: account.id,
            type,
            role_id: account.role_id || null,
            vendor_id: account.vendor_id || null,
            clientstore_id: account.clientstore_id || null,
            client_type: account.client_type || null,
        };
    }

    async validateCredentials(type: ActorType, email: string, password: string, extraCondition: any = {}) {
        const query = this.repositoryFor(type)
            .createQueryBuilder('account')
            .addSelect(['account.password', 'account.token_version'])
            .where('account.email = :email', { email });
        Object.keys(extraCondition).forEach((key) => {
            query.andWhere(`account.${key} = :${key}`, { [key]: extraCondition[key] });
        });
        const account = await query.getOne();
        if (!account || !account.password || !(await bcrypt.compare(password, account.password))) {
            throw new UnauthorizedException('Invalid email or password');
        }
        if (!account.is_active) {
            throw new ForbiddenException('Your account is not active. Please contact support.');
        }
        return account;
    }

    async signToken(id: number, type: ActorType, version: number) {
        return this.jwtService.signAsync({ id, type, ver: version });
    }

    async revokeTokens(actor: AuthActor) {
        await this.repositoryFor(actor.type).increment({ id: actor.id }, 'token_version', 1);
    }

    async changePassword(actor: AuthActor, currentPassword: string, newPassword: string) {
        const account = await this.repositoryFor(actor.type)
            .createQueryBuilder('account')
            .addSelect(['account.password', 'account.token_version'])
            .where('account.id = :id', { id: actor.id })
            .getOne();
        if (!account || !(await bcrypt.compare(currentPassword, account.password))) {
            throw new UnauthorizedException('Current password is incorrect');
        }
        const version = account.token_version + 1;
        await this.repositoryFor(actor.type).update(actor.id, {
            password: await this.hashPassword(newPassword),
            token_version: version,
        });
        return this.signToken(actor.id, actor.type, version);
    }

    async hashPassword(password: string) {
        return bcrypt.hash(password, 12);
    }
}
