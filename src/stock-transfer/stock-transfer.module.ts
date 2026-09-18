import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductModule } from 'src/product/product.module';
import { StockModule } from 'src/stock/stock.module';
import { StockTransferController } from './stock-transfer.controller';
import { StockTransferService } from './stock-transfer.service';
import { StockTransfer } from './models/stock-transfer.entity';
import { StockTransferItem } from './models/stock-transfer-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockTransfer, StockTransferItem], 'MainConnection'),
    ProductModule,
    StockModule,
  ],
  controllers: [StockTransferController],
  providers: [StockTransferService],
})
export class StockTransferModule { }
