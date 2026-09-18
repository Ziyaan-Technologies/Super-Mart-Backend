import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class TaxCreateDto {
    @IsOptional()
    @IsInt()
    vendor_id: number;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Max(100)
    rate: number;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}

export class TaxUpdateDto extends PartialType(TaxCreateDto) { }
