import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductModule } from 'src/product/product.module';
import { SupplierModule } from 'src/supplier/supplier.module';
import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseOrder } from './models/purchase-order.entity';
import { PurchaseOrderItem } from './models/purchase-order-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseOrder, PurchaseOrderItem], 'MainConnection'),
    ProductModule,
    SupplierModule,
  ],
  controllers: [PurchaseOrderController],
  providers: [PurchaseOrderService],
  exports: [PurchaseOrderService]
})
export class PurchaseOrderModule { }
