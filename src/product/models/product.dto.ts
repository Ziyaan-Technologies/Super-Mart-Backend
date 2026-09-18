import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { VendorScopedListDto } from 'src/common/list-query';

export class ProductVariantDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    sku: string;

    @IsOptional()
    @IsString()
    barcode: string;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    unit_quantity: number;

    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    cost_price: number;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    sale_price: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    mrp: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0)
    reorder_level: number;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}

export class ProductCreateDto {
    @IsOptional()
    @IsInt()
    vendor_id: number;

    @IsInt()
    category_id: number;

    @IsOptional()
    @IsInt()
    brand_id: number;

    @IsInt()
    unit_id: number;

    @IsOptional()
    @IsInt()
    tax_id: number;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description: string;

    @IsOptional()
    @IsString()
    image_url: string;

    @IsOptional()
    @IsBoolean()
    price_includes_tax: boolean;

    @IsOptional()
    @IsBoolean()
    is_weighted: boolean;

    @IsOptional()
    @IsBoolean()
    track_expiry: boolean;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => ProductVariantDto)
    variants: ProductVariantDto[];
}

export class ProductUpdateDto extends PartialType(OmitType(ProductCreateDto, ['vendor_id'] as const)) { }

export class ProductListDto extends VendorScopedListDto {
    category_id?: number;
    brand_id?: number;
    include_subcategories?: boolean;
}
