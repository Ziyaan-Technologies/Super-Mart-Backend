import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

export class LoginDto {
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    password: string;
}

export class UserLoginDto extends LoginDto {
    @IsInt()
    vendor_id: number;
}

export class UserRegisterDto {
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

    @IsInt()
    vendor_id: number;

    @IsOptional()
    @IsInt()
    city_id: number;
}

export class ChangePasswordDto {
    @IsNotEmpty()
    @IsString()
    current_password: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    new_password: string;
}

export class UpdateProfileDto {
    @IsOptional()
    @IsNotEmpty()
    @IsString()
    full_name: string;

    @IsOptional()
    @IsNotEmpty()
    @IsString()
    phone: string;

    @IsOptional()
    @IsString()
    image_url: string;
}
