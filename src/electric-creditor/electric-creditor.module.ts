import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElectricAccessModule } from 'src/electric-access/electric-access.module';
import { ElectricCreditorController } from './electric-creditor.controller';
import { ElectricCreditorService } from './electric-creditor.service';
import { ElectricCreditor } from './models/electric-creditor.entity';
import { ElectricCreditorEntry } from './models/electric-creditor-entry.entity';
import { ElectricCreditorPayment } from './models/electric-creditor-payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ElectricCreditor, ElectricCreditorEntry, ElectricCreditorPayment], 'MainConnection'),
    ElectricAccessModule,
  ],
  controllers: [ElectricCreditorController],
  providers: [ElectricCreditorService],
  exports: [ElectricCreditorService]
})
export class ElectricCreditorModule { }
