import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";
import { ListQueryDto } from 'src/common/list-query';
import { BusinessType } from './vendor.entity';

export class VendorOwnerDto {
    @IsNotEmpty()
    @IsString()
    full_name: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    phone: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    password: string;
}

export class VendorCreateDto {
    @IsNotEmpty()
    @IsString()
    business_name: string;

    @IsOptional()
    @IsString()
    owner_name: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    phone: string;

    @IsOptional()
    @IsString()
    address: string;

    @IsOptional()
    @IsString()
    logo_url: string;

    @IsOptional()
    @IsEnum(BusinessType)
    business_type: BusinessType;

    @IsOptional()
    @IsString()
    tax_number: string;

    @IsInt()
    country_id: number;

    @IsOptional()
    @IsInt()
    city_id: number;

    @IsOptional()
    @IsBoolean()
    allow_negative_stock: boolean;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;

    @ValidateNested()
    @Type(() => VendorOwnerDto)
    owner: VendorOwnerDto;
}

export class VendorUpdateDto extends PartialType(OmitType(VendorCreateDto, ['owner'] as const)) { }

export class VendorProfileUpdateDto extends PartialType(OmitType(VendorCreateDto, ['owner', 'email', 'country_id', 'is_active'] as const)) { }

export class VendorListDto extends ListQueryDto {
    business_type?: BusinessType;
    country_id?: number;
}
