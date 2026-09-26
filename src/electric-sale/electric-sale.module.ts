import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElectricAccessModule } from 'src/electric-access/electric-access.module';
import { ElectricQuotationModule } from 'src/electric-quotation/electric-quotation.module';
import { ElectricSaleController } from './electric-sale.controller';
import { ElectricSaleService } from './electric-sale.service';
import { ElectricSale } from './models/electric-sale.entity';
import { ElectricSaleItem } from './models/electric-sale-item.entity';
import { ElectricSaleReturn } from './models/electric-sale-return.entity';
import { ElectricSaleReturnItem } from './models/electric-sale-return-item.entity';
import { ElectricBillPayment } from './models/electric-bill-payment.entity';
import { ElectricDebtor } from 'src/electric-debtor/models/electric-debtor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ElectricSale, ElectricSaleItem, ElectricSaleReturn, ElectricSaleReturnItem, ElectricBillPayment, ElectricDebtor], 'MainConnection'),
    ElectricAccessModule,
    ElectricQuotationModule,
  ],
  controllers: [ElectricSaleController],
  providers: [ElectricSaleService],
  exports: [ElectricSaleService]
})
export class ElectricSaleModule { }
