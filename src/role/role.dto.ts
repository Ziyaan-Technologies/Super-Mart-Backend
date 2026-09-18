import { ArrayUnique, IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ListQueryDto } from "src/common/list-query";
import { RoleType } from "./role.entity";

export class RoleCreateDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsEnum(RoleType)
    type: RoleType;

    @IsOptional()
    @IsInt()
    vendor_id: number;

    @IsArray()
    @ArrayUnique()
    @IsInt({ each: true })
    permissions: number[];
}

export class RoleUpdateDto {
    @IsOptional()
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsInt({ each: true })
    permissions: number[];
}

export class RoleListDto extends ListQueryDto {
    type?: RoleType;
    vendor_id?: number;
}
