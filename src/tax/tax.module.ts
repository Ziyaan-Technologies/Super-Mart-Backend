import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';
import { Tax } from './models/tax.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tax], 'MainConnection'),
  ],
  controllers: [TaxController],
  providers: [TaxService],
  exports: [TaxService]
})
export class TaxModule { }
