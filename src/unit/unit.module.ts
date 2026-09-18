import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitController } from './unit.controller';
import { UnitService } from './unit.service';
import { Unit } from './models/unit.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Unit], 'MainConnection'),
  ],
  controllers: [UnitController],
  providers: [UnitService],
  exports: [UnitService]
})
export class UnitModule { }
