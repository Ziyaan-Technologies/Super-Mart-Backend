import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class ElectricVariantDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    barcode: string;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    cost_price: number;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    sale_price: number;

    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0)
    stock: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0)
    reorder_level: number;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}

export class ElectricProductDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    number: number | null;

    @IsInt()
    clientstore_id: number;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsInt()
    category_id: number;

    @IsOptional()
    brand_id: number | null;

    @IsOptional()
    @IsString()
    image_url: string;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ElectricVariantDto)
    variants: ElectricVariantDto[];
}

export class ElectricStockDto {
    @IsInt()
    variant_id: number;

    @IsNumber()
    quantity: number;

    @IsNumber()
    cost_price: number;

    @IsOptional()
    @IsString()
    supplier: string;

    @IsOptional()
    @IsString()
    note: string;
}
