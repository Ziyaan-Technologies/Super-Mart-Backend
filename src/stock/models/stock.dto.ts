import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { VendorScopedListDto } from 'src/common/list-query';

export class StockListDto extends VendorScopedListDto {
    clientstore_id?: number;
    category_id?: number;
    brand_id?: number;
    stock_status?: 'in' | 'low' | 'out';
}

export class StockMovementListDto extends VendorScopedListDto {
    clientstore_id?: number;
    product_variant_id?: number;
    type?: string;
}

export class StockExpiryListDto extends VendorScopedListDto {
    clientstore_id?: number;
    days?: number;
    include_expired?: boolean;
}

export class OpeningStockItemDto {
    @IsInt()
    product_variant_id: number;

    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    quantity: number;

    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    unit_cost: number;

    @IsOptional()
    @IsString()
    batch_number: string;

    @IsOptional()
    @IsDateString()
    expiry_date: string;
}

export class OpeningStockDto {
    @IsInt()
    clientstore_id: number;

    @IsOptional()
    @IsString()
    note: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => OpeningStockItemDto)
    items: OpeningStockItemDto[];
}
