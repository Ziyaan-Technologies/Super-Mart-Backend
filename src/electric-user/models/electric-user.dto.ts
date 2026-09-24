import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ElectricRoleDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsArray()
    @IsInt({ each: true })
    permissions: number[];
}

export class ElectricUserDto {
    @IsNotEmpty()
    @IsString()
    full_name: string;

    @IsNotEmpty()
    @IsString()
    email: string;

    @IsNotEmpty()
    @IsString()
    phone: string;

    @IsOptional()
    @IsString()
    @MinLength(6)
    password: string;

    @IsInt()
    role_id: number;

    @IsOptional()
    clientstore_id: number | null;

    @IsOptional()
    counter_id: number | null;

    @IsOptional()
    @IsString()
    image_url: string;

    @IsOptional()
    @IsBoolean()
    is_active: boolean;
}
