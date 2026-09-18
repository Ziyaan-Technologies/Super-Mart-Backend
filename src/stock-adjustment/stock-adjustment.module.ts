import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductModule } from 'src/product/product.module';
import { StockModule } from 'src/stock/stock.module';
import { StockAdjustmentController } from './stock-adjustment.controller';
import { StockAdjustmentService } from './stock-adjustment.service';
import { StockAdjustment } from './models/stock-adjustment.entity';
import { StockAdjustmentItem } from './models/stock-adjustment-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockAdjustment, StockAdjustmentItem], 'MainConnection'),
    ProductModule,
    StockModule,
  ],
  controllers: [StockAdjustmentController],
  providers: [StockAdjustmentService],
})
export class StockAdjustmentModule { }
