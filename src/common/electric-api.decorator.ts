import { SetMetadata } from '@nestjs/common';

export const ELECTRIC_API_KEY = 'electricApi';

export const ElectricApi = () => SetMetadata(ELECTRIC_API_KEY, true);
