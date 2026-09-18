import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { VendorScopedListDto } from 'src/common/list-query';
import { GoodsReceiptStatus } from './goods-receipt.entity';

export class GoodsReceiptItemDto {
    @IsInt()
    product_variant_id: number;

    @IsOptional()
    @IsInt()
    purchase_order_item_id: number;

    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    quantity: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0)
    free_quantity: number;

    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(0)
    unit_cost: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    @Max(100)
    tax_rate: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    discount_amount: number;

    @IsOptional()
    @IsString()
    batch_number: string;

    @IsOptional()
    @IsDateString()
    expiry_date: string;
}

export class GoodsReceiptCreateDto {
    @IsInt()
    clientstore_id: number;

    @IsInt()
    supplier_id: number;

    @IsOptional()
    @IsInt()
    purchase_order_id: number;

    @IsDateString()
    received_date: string;

    @IsOptional()
    @IsString()
    supplier_invoice_number: string;

    @IsOptional()
    @IsString()
    note: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => GoodsReceiptItemDto)
    items: GoodsReceiptItemDto[];
}

export class GoodsReceiptUpdateDto extends PartialType(GoodsReceiptCreateDto) { }

export class GoodsReceiptListDto extends VendorScopedListDto {
    clientstore_id?: number;
    supplier_id?: number;
    purchase_order_id?: number;
    status?: GoodsReceiptStatus;
}
