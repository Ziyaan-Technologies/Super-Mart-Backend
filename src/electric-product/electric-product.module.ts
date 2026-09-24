import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElectricAccessModule } from 'src/electric-access/electric-access.module';
import { ElectricBrand } from 'src/electric-brand/models/electric-brand.entity';
import { ElectricCategory } from 'src/electric-category/models/electric-category.entity';
import { ElectricProductController } from './electric-product.controller';
import { ElectricProductService } from './electric-product.service';
import { ElectricProduct } from './models/electric-product.entity';
import { ElectricProductVariant } from './models/electric-product-variant.entity';
import { ElectricStockEntry } from './models/electric-stock-entry.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ElectricProduct, ElectricProductVariant, ElectricStockEntry, ElectricBrand, ElectricCategory], 'MainConnection'),
    ElectricAccessModule,
  ],
  controllers: [ElectricProductController],
  providers: [ElectricProductService],
  exports: [ElectricProductService]
})
export class ElectricProductModule { }
