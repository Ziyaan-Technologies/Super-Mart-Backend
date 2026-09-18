import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import { VendorScopedListDto } from 'src/common/list-query';

export class CategoryCreateDto {
    @IsOptional()
    @IsInt()
    vendor_id: number;

    @IsOptional()
    @IsInt()
    parent_id: number;

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
    @IsInt()
    @Min(0)
    sort_order: number;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}

export class CategoryUpdateDto extends PartialType(CategoryCreateDto) { }

export class CategoryListDto extends VendorScopedListDto {
    parent_id?: number | 'root';
    level?: number;
}
