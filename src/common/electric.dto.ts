import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from './list-query';

export class ElectricListDto extends ListQueryDto {
    clientstore_id?: number;
    category_id?: number;
    brand_id?: number;
    counter_id?: number;
    role_id?: number;
    session_id?: number;
    payment_method?: string;
    balance?: string;
}

export class ElectricNamedDto {
    @IsInt()
    clientstore_id: number;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description: string;

    @IsOptional()
    @IsString()
    image_url: string;

    @IsOptional()
    @IsInt()
    sort_order: number;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}

export class ElectricNamedUpdateDto extends PartialType(ElectricNamedDto) { }
