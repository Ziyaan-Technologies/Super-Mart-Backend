import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductModule } from 'src/product/product.module';
import { SupplierModule } from 'src/supplier/supplier.module';
import { StockModule } from 'src/stock/stock.module';
import { PurchaseOrderModule } from 'src/purchase-order/purchase-order.module';
import { GoodsReceiptController } from './goods-receipt.controller';
import { GoodsReceiptService } from './goods-receipt.service';
import { GoodsReceipt } from './models/goods-receipt.entity';
import { GoodsReceiptItem } from './models/goods-receipt-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([GoodsReceipt, GoodsReceiptItem], 'MainConnection'),
    ProductModule,
    SupplierModule,
    StockModule,
    PurchaseOrderModule,
  ],
  controllers: [GoodsReceiptController],
  providers: [GoodsReceiptService],
})
export class GoodsReceiptModule { }
