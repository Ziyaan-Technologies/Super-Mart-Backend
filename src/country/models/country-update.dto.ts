import { PartialType } from '@nestjs/mapped-types';
import { CountryCreateDto } from './country-create.dto';

export class CountryUpdateDto extends PartialType(CountryCreateDto) { }
