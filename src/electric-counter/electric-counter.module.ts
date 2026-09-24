import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElectricAccessModule } from 'src/electric-access/electric-access.module';
import { ElectricSaleModule } from 'src/electric-sale/electric-sale.module';
import { ElectricSale } from 'src/electric-sale/models/electric-sale.entity';
import { ElectricSaleReturn } from 'src/electric-sale/models/electric-sale-return.entity';
import { ElectricCounterController } from './electric-counter.controller';
import { ElectricCounterService } from './electric-counter.service';
import { ElectricCounterSubscriber } from './electric-counter.subscriber';
import { ElectricCounter } from './models/electric-counter.entity';
import { ElectricCounterSession } from './models/electric-counter-session.entity';
import { ElectricCashMove } from './models/electric-cash-move.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ElectricCounter, ElectricCounterSession, ElectricCashMove, ElectricSale, ElectricSaleReturn], 'MainConnection'),
    ElectricAccessModule,
    ElectricSaleModule,
  ],
  controllers: [ElectricCounterController],
  providers: [ElectricCounterService, ElectricCounterSubscriber],
  exports: [ElectricCounterService]
})
export class ElectricCounterModule { }
