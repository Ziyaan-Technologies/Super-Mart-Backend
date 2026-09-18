import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { VendorScopedListDto } from 'src/common/list-query';
import { PurchaseOrderStatus } from './purchase-order.entity';

export class PurchaseOrderItemDto {
    @IsInt()
    product_variant_id: number;

    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    quantity: number;

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
}

export class PurchaseOrderCreateDto {
    @IsInt()
    clientstore_id: number;

    @IsInt()
    supplier_id: number;

    @IsDateString()
    order_date: string;

    @IsOptional()
    @IsDateString()
    expected_date: string;

    @IsOptional()
    @IsString()
    note: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => PurchaseOrderItemDto)
    items: PurchaseOrderItemDto[];
}

export class PurchaseOrderUpdateDto extends PartialType(PurchaseOrderCreateDto) { }

export class PurchaseOrderListDto extends VendorScopedListDto {
    clientstore_id?: number;
    supplier_id?: number;
    status?: PurchaseOrderStatus;
}
