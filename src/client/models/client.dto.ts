import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import { ListQueryDto } from 'src/common/list-query';
import { ClientType } from './client.entity';

export class ClientCreateDto {
    @IsOptional()
    @IsInt()
    vendor_id: number;

    @IsOptional()
    @IsInt()
    clientstore_id: number;

    @IsOptional()
    @IsEnum(ClientType)
    client_type: ClientType;

    @IsNotEmpty()
    @IsString()
    full_name: string;

    @IsNotEmpty()
    @IsString()
    phone: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    password: string;

    @IsOptional()
    @IsString()
    image_url: string;

    @IsInt()
    role_id: number;

    @IsOptional()
    @IsInt()
    country_id: number;

    @IsOptional()
    @IsInt()
    city_id: number;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}

export class ClientUpdateDto extends PartialType(OmitType(ClientCreateDto, ['password', 'vendor_id', 'client_type'] as const)) {
    @IsOptional()
    @IsString()
    @MinLength(6)
    password: string;
}

export class ClientListDto extends ListQueryDto {
    vendor_id?: number;
    clientstore_id?: number;
    client_type?: ClientType;
    role_id?: number;
}
