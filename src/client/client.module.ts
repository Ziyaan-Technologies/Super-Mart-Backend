import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from 'src/role/role.entity';
import { RoleModule } from 'src/role/role.module';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { Client } from './models/client.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Role], 'MainConnection'),
    RoleModule,
  ],
  controllers: [ClientController],
  providers: [ClientService],
  exports: [ClientService]
})
export class ClientModule { }
