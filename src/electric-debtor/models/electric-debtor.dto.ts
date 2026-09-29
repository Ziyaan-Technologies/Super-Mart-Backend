import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class ElectricDebtorDto {
    @IsOptional()
    @IsNumber()
    clientstore_id: number;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    phone: string;

    @IsOptional()
    @IsString()
    address: string;

    @IsOptional()
    @IsString()
    image_url: string;

    @IsOptional()
    @IsNumber()
    opening_balance: number;

    @IsOptional()
    @IsString()
    note: string;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}

export class ElectricDebtorUpdateDto extends PartialType(ElectricDebtorDto) { }

export class ElectricDebtorPaymentDto {
    @IsNumber()
    amount: number;

    @IsOptional()
    @IsNumber()
    clientstore_id: number;

    @IsOptional()
    @IsNumber()
    session_id: number;

    @IsOptional()
    @IsString()
    method: string;

    @IsOptional()
    @IsString()
    note: string;
}
