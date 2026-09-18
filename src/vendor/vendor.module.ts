import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';
import { Vendor } from './models/vendor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vendor], 'MainConnection'),
  ],
  controllers: [VendorController],
  providers: [VendorService],
  exports: [VendorService]
})
export class VendorModule { }
