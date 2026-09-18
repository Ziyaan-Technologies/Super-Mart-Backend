import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { VendorScopedListDto } from 'src/common/list-query';
import { AdjustmentReason, StockAdjustmentStatus } from './stock-adjustment.entity';

export class StockAdjustmentItemDto {
    @IsInt()
    product_variant_id: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    quantity: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0)
    counted_quantity: number;

    @IsOptional()
    @IsInt()
    stock_batch_id: number;

    @IsOptional()
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

export class StockAdjustmentCreateDto {
    @IsInt()
    clientstore_id: number;

    @IsDateString()
    adjustment_date: string;

    @IsEnum(AdjustmentReason)
    reason: AdjustmentReason;

    @IsOptional()
    @IsString()
    note: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => StockAdjustmentItemDto)
    items: StockAdjustmentItemDto[];
}

export class StockAdjustmentUpdateDto extends PartialType(StockAdjustmentCreateDto) { }

export class StockAdjustmentListDto extends VendorScopedListDto {
    clientstore_id?: number;
    reason?: AdjustmentReason;
    status?: StockAdjustmentStatus;
}
