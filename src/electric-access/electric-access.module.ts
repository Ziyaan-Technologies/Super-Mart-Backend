import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clientstore } from 'src/clientstore/models/clientstore.entity';
import { Client } from 'src/client/models/client.entity';
import { RoleModule } from 'src/role/role.module';
import { ElectricCounterSession } from 'src/electric-counter/models/electric-counter-session.entity';
import { ElectricAccessService } from './electric-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Clientstore, Client, ElectricCounterSession], 'MainConnection'),
    RoleModule,
  ],
  providers: [ElectricAccessService],
  exports: [ElectricAccessService]
})
export class ElectricAccessModule { }
