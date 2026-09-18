import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from 'src/admin/models/admin.entity';
import { Client } from 'src/client/models/client.entity';
import { User } from 'src/user/models/user.entity';
import { Vendor } from 'src/vendor/models/vendor.entity';
import { Role } from 'src/role/role.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Admin, Client, User, Vendor, Role], 'MainConnection'),
    ],
    controllers: [AuthController],
    providers: [AuthService],
    exports: [AuthService]
})
export class AuthModule { }
