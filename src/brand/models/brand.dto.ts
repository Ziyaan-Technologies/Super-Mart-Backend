import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class BrandCreateDto {
    @IsOptional()
    @IsInt()
    vendor_id: number;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    image_url: string;

    @IsOptional()
    @IsString()
    description: string;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}

export class BrandUpdateDto extends PartialType(BrandCreateDto) { }
