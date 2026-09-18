import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { Brand } from './models/brand.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Brand], 'MainConnection'),
  ],
  controllers: [BrandController],
  providers: [BrandService],
  exports: [BrandService]
})
export class BrandModule { }
