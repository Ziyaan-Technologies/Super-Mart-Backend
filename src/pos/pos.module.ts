import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleModule } from 'src/role/role.module';
import { CategoryModule } from 'src/category/category.module';
import { ProductModule } from 'src/product/product.module';
import { StockModule } from 'src/stock/stock.module';
import { User } from 'src/user/models/user.entity';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { ReceiptService } from './receipt.service';
import { RegisterSession } from './models/register-session.entity';
import { Sale } from './models/sale.entity';
import { SaleItem } from './models/sale-item.entity';
import { SalePayment } from './models/sale-payment.entity';
import { SaleReturn } from './models/sale-return.entity';
import { SaleReturnItem } from './models/sale-return-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([RegisterSession, Sale, SaleItem, SalePayment, SaleReturn, SaleReturnItem, User], 'MainConnection'),
    RoleModule,
    CategoryModule,
    ProductModule,
    StockModule,
  ],
  controllers: [PosController],
  providers: [PosService, ReceiptService],
})
export class PosModule { }
