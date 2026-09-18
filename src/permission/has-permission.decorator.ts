import { SetMetadata } from "@nestjs/common";

export const PERMISSION_KEY = 'permission';

export const HasPermission = (...permissionKeys: string[]) => SetMetadata(PERMISSION_KEY, permissionKeys);
