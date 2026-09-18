import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { VendorScopedListDto } from 'src/common/list-query';
import { PaymentMethod } from './sale-payment.entity';

export class OpenRegisterDto {
    @IsInt()
    clientstore_id: number;

    @IsOptional()
    @IsString()
    note: string;
}

export class OpeningCashDto {
    @IsInt()
    clientstore_id: number;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    opening_cash: number;
}

export class CloseRegisterDto {
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    closing_cash: number;

    @IsOptional()
    @IsString()
    note: string;
}

export class SaleLineDto {
    @IsInt()
    product_variant_id: number;

    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    quantity: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    discount_amount: number;
}

export class SalePaymentDto {
    @IsEnum(PaymentMethod)
    method: PaymentMethod;

    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    amount: number;

    @IsOptional()
    @IsString()
    reference: string;

    @IsOptional()
    @IsInt()
    bank_id: number;
}

export class SaleCreateDto {
    @IsInt()
    clientstore_id: number;

    @IsOptional()
    @IsInt()
    user_id: number;

    @IsOptional()
    @IsString()
    customer_name: string;

    @IsOptional()
    @IsString()
    customer_phone: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => SaleLineDto)
    items: SaleLineDto[];

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    bill_discount: number;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => SalePaymentDto)
    payments: SalePaymentDto[];

    @IsOptional()
    @IsString()
    note: string;
}

export class SaleReturnLineDto {
    @IsInt()
    sale_item_id: number;

    @IsNumber({ maxDecimalPlaces: 3 })
    @Min(0.001)
    quantity: number;
}

export class SaleReturnDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => SaleReturnLineDto)
    items: SaleReturnLineDto[];

    @IsEnum(PaymentMethod)
    refund_method: PaymentMethod;

    @IsNotEmpty()
    @IsString()
    reason: string;
}

export class SaleListDto extends VendorScopedListDto {
    clientstore_id?: number;
    cashier_id?: number;
    register_session_id?: number;
}

export class RegisterListDto extends VendorScopedListDto {
    clientstore_id?: number;
    cashier_id?: number;
}
