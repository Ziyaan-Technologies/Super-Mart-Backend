import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CityCreateDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsInt()
    country_id: number;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}
