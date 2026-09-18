import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankController } from './bank.controller';
import { BankService } from './bank.service';
import { Bank } from './models/bank.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bank], 'MainConnection'),
  ],
  controllers: [BankController],
  providers: [BankService],
  exports: [BankService]
})
export class BankModule { }
