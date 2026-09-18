import { ValueTransformer } from 'typeorm';

export const DecimalTransformer: ValueTransformer = {
    to: (value: number | null) => value,
    from: (value: string | null) => (value === null || value === undefined ? null : parseFloat(value)),
};

export function roundQuantity(value: number) {
    return Math.round((Number(value) || 0) * 1000) / 1000;
}

export function roundAmount(value: number) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

export function roundCost(value: number) {
    return Math.round((Number(value) || 0) * 10000) / 10000;
}
