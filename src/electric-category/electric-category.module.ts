import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElectricAccessModule } from 'src/electric-access/electric-access.module';
import { ElectricCategoryController } from './electric-category.controller';
import { ElectricCategoryService } from './electric-category.service';
import { ElectricCategory } from './models/electric-category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ElectricCategory], 'MainConnection'),
    ElectricAccessModule,
  ],
  controllers: [ElectricCategoryController],
  providers: [ElectricCategoryService],
  exports: [ElectricCategoryService]
})
export class ElectricCategoryModule { }
