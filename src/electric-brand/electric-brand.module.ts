import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElectricAccessModule } from 'src/electric-access/electric-access.module';
import { ElectricBrandController } from './electric-brand.controller';
import { ElectricBrandService } from './electric-brand.service';
import { ElectricBrand } from './models/electric-brand.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ElectricBrand], 'MainConnection'),
    ElectricAccessModule,
  ],
  controllers: [ElectricBrandController],
  providers: [ElectricBrandService],
  exports: [ElectricBrandService]
})
export class ElectricBrandModule { }
