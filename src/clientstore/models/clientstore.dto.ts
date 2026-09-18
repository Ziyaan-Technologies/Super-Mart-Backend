import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsEmail, IsInt, IsMilitaryTime, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ListQueryDto } from 'src/common/list-query';

export class ClientstoreCreateDto {
    @IsOptional()
    @IsInt()
    vendor_id: number;

    @IsNotEmpty()
    @IsString()
    store_name: string;

    @IsNotEmpty()
    @IsString()
    store_code: string;

    @IsOptional()
    @IsString()
    store_phone: string;

    @IsOptional()
    @IsEmail()
    store_email: string;

    @IsOptional()
    @IsString()
    address: string;

    @IsOptional()
    @IsString()
    lat: string;

    @IsOptional()
    @IsString()
    lng: string;

    @IsOptional()
    @IsString()
    image_url: string;

    @IsInt()
    country_id: number;

    @IsInt()
    city_id: number;

    @IsOptional()
    @IsInt()
    area_id: number;

    @IsOptional()
    @IsMilitaryTime()
    opening_time: string;

    @IsOptional()
    @IsMilitaryTime()
    closing_time: string;

    @IsOptional()
    @IsBoolean()
    is_pos_active: boolean;

    @IsOptional()
    @IsBoolean()
    is_delivery_active: boolean;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}

export class ClientstoreUpdateDto extends PartialType(ClientstoreCreateDto) { }

export class ClientstoreListDto extends ListQueryDto {
    vendor_id?: number;
    city_id?: number;
}
