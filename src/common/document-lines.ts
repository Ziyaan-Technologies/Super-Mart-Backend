import { BadRequestException } from '@nestjs/common';
import { roundAmount } from './decimal.transformer';

export interface PricedLine {
    product_variant_id: number;
    quantity: number;
    unit_cost: number;
    tax_rate?: number;
    discount_amount?: number;
}

export function priceLines<T extends PricedLine>(lines: T[]) {
    let subtotal = 0;
    let discountAmount = 0;
    let taxAmount = 0;
    const priced = lines.map((line) => {
        const gross = roundAmount(line.quantity * line.unit_cost);
        const discount = roundAmount(line.discount_amount || 0);
        if (discount > gross) {
            throw new BadRequestException('A line discount cannot be more than the line amount');
        }
        const tax = roundAmount((gross - discount) * (line.tax_rate || 0) / 100);
        subtotal += gross;
        discountAmount += discount;
        taxAmount += tax;
        return {
            ...line,
            tax_rate: line.tax_rate || 0,
            discount_amount: discount,
            tax_amount: tax,
            line_total: roundAmount(gross - discount + tax),
        };
    });
    return {
        lines: priced,
        subtotal: roundAmount(subtotal),
        discount_amount: roundAmount(discountAmount),
        tax_amount: roundAmount(taxAmount),
        total_amount: roundAmount(subtotal - discountAmount + taxAmount),
    };
}
