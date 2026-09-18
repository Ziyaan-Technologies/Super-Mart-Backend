import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class BankCreateDto {
    @IsOptional()
    @IsInt()
    vendor_id: number;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}

export class BankUpdateDto extends PartialType(BankCreateDto) { }
