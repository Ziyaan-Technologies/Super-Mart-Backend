import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaService } from './area.service';
import { AreaController } from './area.controller';
import { Area } from './models/area.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Area], 'MainConnection'),
  ],
  providers: [AreaService],
  controllers: [AreaController],
  exports: [AreaService]
})
export class AreaModule { }
