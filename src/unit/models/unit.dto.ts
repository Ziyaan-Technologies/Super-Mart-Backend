import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ListQueryDto } from 'src/common/list-query';
import { UnitType } from './unit.entity';

export class UnitCreateDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    short_name: string;

    @IsEnum(UnitType)
    type: UnitType;

    @IsOptional()
    @IsBoolean()
    allow_decimal: boolean;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}

export class UnitUpdateDto extends PartialType(UnitCreateDto) { }

export class UnitListDto extends ListQueryDto {
    type?: UnitType;
}
