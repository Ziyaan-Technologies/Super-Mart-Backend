import { Module } from '@nestjs/common';
import { ElectricAccessModule } from 'src/electric-access/electric-access.module';
import { ElectricCounterModule } from 'src/electric-counter/electric-counter.module';
import { ElectricSaleModule } from 'src/electric-sale/electric-sale.module';
import { ElectricShopController } from './electric-shop.controller';

@Module({
  imports: [
    ElectricAccessModule,
    ElectricCounterModule,
    ElectricSaleModule,
  ],
  controllers: [ElectricShopController],
})
export class ElectricShopModule { }
