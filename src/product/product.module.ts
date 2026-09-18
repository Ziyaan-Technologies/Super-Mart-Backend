import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryModule } from 'src/category/category.module';
import { BrandModule } from 'src/brand/brand.module';
import { TaxModule } from 'src/tax/tax.module';
import { UnitModule } from 'src/unit/unit.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { Product } from './models/product.entity';
import { ProductVariant } from './models/product-variant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductVariant], 'MainConnection'),
    CategoryModule,
    BrandModule,
    TaxModule,
    UnitModule,
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService]
})
export class ProductModule { }
