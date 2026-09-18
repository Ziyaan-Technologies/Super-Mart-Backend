import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountryService } from './country.service';
import { CountryController } from './country.controller';
import { Country } from './models/country.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Country], 'MainConnection'),
  ],
  providers: [CountryService],
  controllers: [CountryController],
  exports: [CountryService]
})
export class CountryModule { }
