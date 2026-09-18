import { BadRequestException, Body, ClassSerializerInterceptor, Controller, Delete, Get, Post, Put, UseInterceptors } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Actor, ActorType, AuthActor } from 'src/common/auth-actor';
import { Public } from 'src/common/public.decorator';
import { Role } from 'src/role/role.entity';
import { User } from 'src/user/models/user.entity';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, UpdateProfileDto, UserLoginDto, UserRegisterDto } from './models/login.dto';

@UseInterceptors(ClassSerializerInterceptor)
@Controller()
export class AuthController {
    constructor(
        private authService: AuthService,
        @InjectRepository(User, 'MainConnection') private readonly userRepository: Repository<User>,
        @InjectRepository(Vendor, 'MainConnection') private readonly vendorRepository: Repository<Vendor>,
        @InjectRepository(Role, 'MainConnection') private readonly roleRepository: Repository<Role>,
    ) {
    }

    private relationsFor(type: ActorType) {
        if (type === ActorType.ADMIN) {
            return ['role', 'country', 'city'];
        }
        if (type === ActorType.CLIENT) {
            return ['role', 'vendor', 'vendor.country', 'clientstore', 'country', 'city'];
        }
        return ['vendor', 'city'];
    }

    private async profile(type: ActorType, id: number) {
        return this.authService.repositoryFor(type).findOne({ where: { id }, relations: this.relationsFor(type) });
    }

    @Public()
    @Post('admin/login')
    async adminLogin(@Body() body: LoginDto) {
        const admin = await this.authService.validateCredentials(ActorType.ADMIN, body.email, body.password);
        const token = await this.authService.signToken(admin.id, ActorType.ADMIN, admin.token_version);
        return {
            token,
            admin: await this.profile(ActorType.ADMIN, admin.id),
        };
    }

    @Public()
    @Post('client/login')
    async clientLogin(@Body() body: LoginDto) {
        const client = await this.authService.validateCredentials(ActorType.CLIENT, body.email, body.password);
        const vendor = await this.vendorRepository.findOne({ where: { id: client.vendor_id } });
        if (!vendor || !vendor.is_active) {
            throw new BadRequestException('Your business account is not active. Please contact support.');
        }
        const token = await this.authService.signToken(client.id, ActorType.CLIENT, client.token_version);
        return {
            token,
            client: await this.profile(ActorType.CLIENT, client.id),
        };
    }

    @Public()
    @Post('user/register')
    async userRegister(@Body() body: UserRegisterDto) {
        const vendor = await this.vendorRepository.findOne({ where: { id: body.vendor_id, is_active: true } });
        if (!vendor) {
            throw new BadRequestException('Store not found');
        }
        const existing = await this.userRepository.findOne({
            where: [
                { email: body.email, vendor: { id: body.vendor_id } },
                { phone: body.phone, vendor: { id: body.vendor_id } },
            ],
        });
        if (existing) {
            throw new BadRequestException('An account with this email or phone already exists');
        }
        const { vendor_id, city_id, password, ...data } = body;
        const user = await this.userRepository.save({
            ...data,
            password: await this.authService.hashPassword(password),
            vendor: { id: vendor_id },
            city: city_id ? { id: city_id } : null,
            is_active: true,
        });
        const token = await this.authService.signToken(user.id, ActorType.USER, 0);
        return {
            token,
            user: await this.profile(ActorType.USER, user.id),
        };
    }

    @Public()
    @Post('user/login')
    async userLogin(@Body() body: UserLoginDto) {
        const user = await this.authService.validateCredentials(ActorType.USER, body.email, body.password, { vendor_id: body.vendor_id });
        const token = await this.authService.signToken(user.id, ActorType.USER, user.token_version);
        return {
            token,
            user: await this.profile(ActorType.USER, user.id),
        };
    }

    @Delete('auth/logout')
    async logout(@Actor() actor: AuthActor) {
        await this.authService.revokeTokens(actor);
        return { message: 'Success' };
    }

    @Get('auth/me')
    async me(@Actor() actor: AuthActor) {
        return this.profile(actor.type, actor.id);
    }

    @Get('auth/me/permissions')
    async myPermissions(@Actor() actor: AuthActor) {
        if (!actor.role_id) {
            return [];
        }
        const role = await this.roleRepository.findOne({ where: { id: actor.role_id }, relations: ['permissions'] });
        return (role?.permissions || []).map((permission) => ({
            permission_key: permission.permission_key,
            module_name: permission.module_name,
        }));
    }

    @Put('auth/me/password')
    async changePassword(@Actor() actor: AuthActor, @Body() body: ChangePasswordDto) {
        const token = await this.authService.changePassword(actor, body.current_password, body.new_password);
        return { message: 'Success', token };
    }

    @Put('auth/me/profile')
    async updateProfile(@Actor() actor: AuthActor, @Body() body: UpdateProfileDto) {
        const repository = this.authService.repositoryFor(actor.type);
        if (body.phone) {
            const where: any = { phone: body.phone };
            if (actor.type === ActorType.USER) {
                where.vendor = { id: actor.vendor_id };
            }
            const existing = await repository.findOne({ where });
            if (existing && existing.id !== actor.id) {
                throw new BadRequestException('Phone number already exists');
            }
        }
        const data: any = {};
        ['full_name', 'phone', 'image_url'].forEach((key) => {
            if (body[key] !== undefined) {
                data[key] = body[key];
            }
        });
        if (Object.keys(data).length) {
            await repository.update(actor.id, data);
        }
        return this.profile(actor.type, actor.id);
    }
}
