import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import { ListQueryDto } from 'src/common/list-query';
import { Gender } from './user.entity';

export class UserCreateDto {
    @IsOptional()
    @IsInt()
    vendor_id: number;

    @IsNotEmpty()
    @IsString()
    full_name: string;

    @IsNotEmpty()
    @IsString()
    phone: string;

    @IsOptional()
    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    @MinLength(6)
    password: string;

    @IsOptional()
    @IsEnum(Gender)
    gender: Gender;

    @IsOptional()
    @IsDateString()
    birthday: string;

    @IsOptional()
    @IsString()
    address: string;

    @IsOptional()
    @IsInt()
    city_id: number;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}

export class UserUpdateDto extends PartialType(UserCreateDto) { }

export class UserListDto extends ListQueryDto {
    vendor_id?: number;
    city_id?: number;
}
