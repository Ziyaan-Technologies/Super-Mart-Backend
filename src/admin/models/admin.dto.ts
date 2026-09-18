import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import { ListQueryDto } from 'src/common/list-query';

export class AdminCreateDto {
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

export class AdminUpdateDto extends PartialType(OmitType(AdminCreateDto, ['password'] as const)) {
    @IsOptional()
    @IsString()
    @MinLength(6)
    password: string;
}

export class AdminListDto extends ListQueryDto {
    role_id?: number;
}
