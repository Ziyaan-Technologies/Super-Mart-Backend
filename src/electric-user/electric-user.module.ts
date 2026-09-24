import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from 'src/client/models/client.entity';
import { Permission } from 'src/permission/permission.entity';
import { Role } from 'src/role/role.entity';
import { RoleModule } from 'src/role/role.module';
import { ElectricAccessModule } from 'src/electric-access/electric-access.module';
import { ElectricCounter } from 'src/electric-counter/models/electric-counter.entity';
import { ElectricCounterSession } from 'src/electric-counter/models/electric-counter-session.entity';
import { ElectricUserController } from './electric-user.controller';
import { ElectricUserService } from './electric-user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Permission, Client, ElectricCounter, ElectricCounterSession], 'MainConnection'),
    ElectricAccessModule,
    RoleModule,
  ],
  controllers: [ElectricUserController],
  providers: [ElectricUserService],
  exports: [ElectricUserService]
})
export class ElectricUserModule { }
