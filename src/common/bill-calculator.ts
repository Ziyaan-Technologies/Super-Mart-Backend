import { roundAmount } from 'src/common/decimal.transformer';

export type DiscountType = 'percent' | 'amount';

export interface BillLine {
    quantity: number;
    unit_price: number;
    discount_type: DiscountType;
    discount_value: number;
    bill_discount_code?: string | null;
}

export interface BillDiscount {
    code: string;
    type: DiscountType;
    value: number;
}

export interface LineAmounts {
    gross: number;
    item_discount: number;
    bill_discount: number;
    total: number;
}

function itemDiscount(line: BillLine, gross: number) {
    const value = Math.max(0, Number(line.discount_value) || 0);
    if (!value) return 0;
    return roundAmount(Math.min(gross, line.discount_type === 'percent' ? gross * Math.min(value, 100) / 100 : value));
}

export function activeDiscounts(lines: BillLine[], discounts: BillDiscount[]) {
    return discounts.filter((discount) => lines.some((line) => line.bill_discount_code === discount.code));
}

export function calculateBill(lines: BillLine[], discounts: BillDiscount[]) {
    const amounts: LineAmounts[] = lines.map((line) => {
        const gross = roundAmount((Number(line.quantity) || 0) * (Number(line.unit_price) || 0));
        const discount = itemDiscount(line, gross);
        return { gross, item_discount: discount, bill_discount: 0, total: roundAmount(gross - discount) };
    });

    const groups = activeDiscounts(lines, discounts).map((discount) => {
        const indexes = lines.map((line, index) => (line.bill_discount_code === discount.code ? index : -1)).filter((index) => index >= 0);
        const base = roundAmount(indexes.reduce((sum, index) => sum + amounts[index].total, 0));
        const value = Math.max(0, Number(discount.value) || 0);
        const target = roundAmount(Math.min(base, discount.type === 'percent' ? base * Math.min(value, 100) / 100 : value));
        let given = 0;
        indexes.forEach((index, position) => {
            const share = position === indexes.length - 1
                ? roundAmount(target - given)
                : base ? roundAmount(target * amounts[index].total / base) : 0;
            given = roundAmount(given + share);
            amounts[index].bill_discount = share;
            amounts[index].total = roundAmount(amounts[index].total - share);
        });
        return { code: discount.code, type: discount.type, value, base, amount: target, lines: indexes.length };
    });

    const totals = amounts.reduce((sum, row) => ({
        subtotal: roundAmount(sum.subtotal + row.gross),
        item_discount: roundAmount(sum.item_discount + row.item_discount),
        bill_discount: roundAmount(sum.bill_discount + row.bill_discount),
        total: roundAmount(sum.total + row.total),
    }), { subtotal: 0, item_discount: 0, bill_discount: 0, total: 0 });

    return { lines: amounts, discounts: groups, ...totals };
}
