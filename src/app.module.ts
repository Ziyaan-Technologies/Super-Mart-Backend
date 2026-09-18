import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeormOptions } from './database/typeorm-options';
import { CommonModule } from './common/common.module';
import { PermissionGuard } from './permission/permission.guard';
import { AuthModule } from './auth/auth.module';
import { RoleModule } from './role/role.module';
import { PermissionModule } from './permission/permission.module';
import { CountryModule } from './country/country.module';
import { CityModule } from './city/city.module';
import { AreaModule } from './area/area.module';
import { AdminModule } from './admin/admin.module';
import { VendorModule } from './vendor/vendor.module';
import { ClientstoreModule } from './clientstore/clientstore.module';
import { ClientModule } from './client/client.module';
import { UserModule } from './user/user.module';
import { UploadModule } from './upload/upload.module';
import { UnitModule } from './unit/unit.module';
import { CategoryModule } from './category/category.module';
import { BrandModule } from './brand/brand.module';
import { TaxModule } from './tax/tax.module';
import { BankModule } from './bank/bank.module';
import { SupplierModule } from './supplier/supplier.module';
import { ProductModule } from './product/product.module';
import { StockModule } from './stock/stock.module';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { GoodsReceiptModule } from './goods-receipt/goods-receipt.module';
import { StockTransferModule } from './stock-transfer/stock-transfer.module';
import { StockAdjustmentModule } from './stock-adjustment/stock-adjustment.module';
import { PosModule } from './pos/pos.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        TypeOrmModule.forRootAsync({
            name: 'MainConnection',
            useFactory: () => ({
                ...typeormOptions(),
                name: 'MainConnection',
                entities: [],
                migrations: [],
                autoLoadEntities: true,
            }),
        }),
        CommonModule,
        AuthModule,
        RoleModule,
        PermissionModule,
        CountryModule,
        CityModule,
        AreaModule,
        AdminModule,
        VendorModule,
        ClientstoreModule,
        ClientModule,
        UserModule,
        UploadModule,
        UnitModule,
        CategoryModule,
        BrandModule,
        TaxModule,
        BankModule,
        SupplierModule,
        ProductModule,
        StockModule,
        PurchaseOrderModule,
        GoodsReceiptModule,
        StockTransferModule,
        StockAdjustmentModule,
        PosModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: PermissionGuard
        }
    ],
})
export class AppModule { }
