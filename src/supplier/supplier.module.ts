import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplierController } from './supplier.controller';
import { SupplierService } from './supplier.service';
import { Supplier } from './models/supplier.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplier], 'MainConnection'),
  ],
  controllers: [SupplierController],
  providers: [SupplierService],
  exports: [SupplierService]
})
export class SupplierModule { }
