import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElectricAccessModule } from 'src/electric-access/electric-access.module';
import { ElectricCashMove } from 'src/electric-counter/models/electric-cash-move.entity';
import { ElectricExpenseController } from './electric-expense.controller';
import { ElectricExpenseService } from './electric-expense.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ElectricCashMove], 'MainConnection'),
    ElectricAccessModule,
  ],
  controllers: [ElectricExpenseController],
  providers: [ElectricExpenseService],
  exports: [ElectricExpenseService]
})
export class ElectricExpenseModule { }
