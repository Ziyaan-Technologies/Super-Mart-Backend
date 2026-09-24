import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElectricAccessModule } from 'src/electric-access/electric-access.module';
import { ElectricSale } from 'src/electric-sale/models/electric-sale.entity';
import { ElectricDebtorController } from './electric-debtor.controller';
import { ElectricDebtorService } from './electric-debtor.service';
import { ElectricDebtor } from './models/electric-debtor.entity';
import { ElectricDebtorPayment } from './models/electric-debtor-payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ElectricDebtor, ElectricDebtorPayment, ElectricSale], 'MainConnection'),
    ElectricAccessModule,
  ],
  controllers: [ElectricDebtorController],
  providers: [ElectricDebtorService],
  exports: [ElectricDebtorService]
})
export class ElectricDebtorModule { }
