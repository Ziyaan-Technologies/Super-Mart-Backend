import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { Category } from './models/category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category], 'MainConnection'),
  ],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService]
})
export class CategoryModule { }
