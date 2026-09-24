import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElectricAccessModule } from 'src/electric-access/electric-access.module';
import { ElectricSale } from 'src/electric-sale/models/electric-sale.entity';
import { ElectricQuotationController } from './electric-quotation.controller';
import { ElectricQuotationService } from './electric-quotation.service';
import { ElectricQuotation } from './models/electric-quotation.entity';
import { ElectricQuotationItem } from './models/electric-quotation-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ElectricQuotation, ElectricQuotationItem, ElectricSale], 'MainConnection'),
    ElectricAccessModule,
  ],
  controllers: [ElectricQuotationController],
  providers: [ElectricQuotationService],
  exports: [ElectricQuotationService]
})
export class ElectricQuotationModule { }
