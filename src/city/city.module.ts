import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CityService } from './city.service';
import { CityController } from './city.controller';
import { City } from './models/city.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([City], 'MainConnection'),
  ],
  providers: [CityService],
  controllers: [CityController],
  exports: [CityService]
})
export class CityModule { }
