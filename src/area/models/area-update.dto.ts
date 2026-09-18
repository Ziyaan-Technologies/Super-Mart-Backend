import { PartialType } from '@nestjs/mapped-types';
import { AreaCreateDto } from './area-create.dto';

export class AreaUpdateDto extends PartialType(AreaCreateDto) { }
