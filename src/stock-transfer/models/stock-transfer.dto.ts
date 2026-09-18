import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { VendorScopedListDto } from 'src/common/list-query';
import { StockTransferStatus } from './stock-transfer.entity';

export class StockTransferItemDto {
    @IsInt()
    product_variant_id: number;

    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    quantity: number;
}

export class StockTransferCreateDto {
    @IsInt()
    from_clientstore_id: number;

    @IsInt()
    to_clientstore_id: number;

    @IsDateString()
    transfer_date: string;

    @IsOptional()
    @IsString()
    note: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => StockTransferItemDto)
    items: StockTransferItemDto[];
}

export class StockTransferUpdateDto extends PartialType(StockTransferCreateDto) { }

export class StockTransferReceiveItemDto {
    @IsInt()
    id: number;

    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0)
    received_quantity: number;
}

export class StockTransferReceiveDto {
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => StockTransferReceiveItemDto)
    items: StockTransferReceiveItemDto[];

    @IsOptional()
    @IsString()
    receive_note: string;
}

export class StockTransferListDto extends VendorScopedListDto {
    clientstore_id?: number;
    direction?: 'incoming' | 'outgoing';
    status?: StockTransferStatus;
}
