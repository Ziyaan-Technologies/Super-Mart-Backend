import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class AreaCreateDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsInt()
    city_id: number;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}
