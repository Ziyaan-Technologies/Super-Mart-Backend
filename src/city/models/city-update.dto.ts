import { PartialType } from '@nestjs/mapped-types';
import { CityCreateDto } from './city-create.dto';

export class CityUpdateDto extends PartialType(CityCreateDto) { }
