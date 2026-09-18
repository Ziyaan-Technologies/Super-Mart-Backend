import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class SupplierCreateDto {
    @IsOptional()
    @IsInt()
    vendor_id: number;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    contact_person: string;

    @IsOptional()
    @IsString()
    phone: string;

    @IsOptional()
    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    address: string;

    @IsOptional()
    @IsInt()
    city_id: number;

    @IsOptional()
    @IsString()
    tax_number: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    payment_terms_days: number;

    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2 })
    opening_balance: number;

    @IsOptional()
    @IsString()
    note: string;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}

export class SupplierUpdateDto extends PartialType(SupplierCreateDto) { }
