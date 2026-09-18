import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryModule } from 'src/category/category.module';
import { ProductModule } from 'src/product/product.module';
import { ProductVariant } from 'src/product/models/product-variant.entity';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { Stock } from './models/stock.entity';
import { StockBatch } from './models/stock-batch.entity';
import { StockMovement } from './models/stock-movement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Stock, StockBatch, StockMovement, ProductVariant], 'MainConnection'),
    CategoryModule,
    ProductModule,
  ],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService]
})
export class StockModule { }
