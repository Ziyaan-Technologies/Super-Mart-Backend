import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CountryCreateDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    country_code: string;

    @IsOptional()
    @IsString()
    phone_code: string;

    @IsNotEmpty()
    @IsString()
    currency_short_name: string;

    @IsOptional()
    @IsString()
    currency_symbol: string;

    @IsNotEmpty()
    @IsString()
    country_time_zone: string;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}
