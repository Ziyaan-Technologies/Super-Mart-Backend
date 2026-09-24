import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { LoggingMiddleware } from './common/logging.middleware';
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
import { ElectricAccessModule } from './electric-access/electric-access.module';
import { ElectricBrandModule } from './electric-brand/electric-brand.module';
import { ElectricCategoryModule } from './electric-category/electric-category.module';
import { ElectricProductModule } from './electric-product/electric-product.module';
import { ElectricCounterModule } from './electric-counter/electric-counter.module';
import { ElectricDebtorModule } from './electric-debtor/electric-debtor.module';
import { ElectricSaleModule } from './electric-sale/electric-sale.module';
import { ElectricQuotationModule } from './electric-quotation/electric-quotation.module';
import { ElectricUserModule } from './electric-user/electric-user.module';
import { ElectricShopModule } from './electric-shop/electric-shop.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        TypeOrmModule.forRoot({
            name: 'MainConnection',
            type: 'mysql',
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            username: process.env.DB_USER_NAME,
            password: process.env.DB_USER_PASSWORD,
            database: process.env.DB_NAME,
            autoLoadEntities: true,
            synchronize: true,
            logging: false,
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
        ElectricAccessModule,
        ElectricBrandModule,
        ElectricCategoryModule,
        ElectricProductModule,
        ElectricCounterModule,
    ElectricDebtorModule,
        ElectricSaleModule,
        ElectricQuotationModule,
        ElectricUserModule,
        ElectricShopModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: PermissionGuard
        }
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(LoggingMiddleware).forRoutes('*');
    }
}
