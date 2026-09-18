import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as moment from 'moment-timezone';

const WIDTH = 216;
const MARGIN = 10;

@Injectable()
export class ReceiptService {
    private money(value: number) {
        return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    private quantity(value: number) {
        return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
    }

    private draw(doc: any, sale: any) {
        const inner = WIDTH - MARGIN * 2;
        const currency = sale.vendor?.country?.currency_symbol || sale.vendor?.country?.currency_short_name || '';
        const timeZone = sale.vendor?.country?.country_time_zone || 'Asia/Karachi';
        const line = () => {
            doc.moveDown(0.3);
            doc.moveTo(MARGIN, doc.y).lineTo(WIDTH - MARGIN, doc.y).dash(2, { space: 2 }).stroke().undash();
            doc.moveDown(0.4);
        };
        const row = (left: string, right: string, options: { bold?: boolean; size?: number } = {}) => {
            doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(options.size || 8);
            const y = doc.y;
            doc.text(left, MARGIN, y, { width: inner * 0.6 });
            const leftBottom = doc.y;
            doc.text(right, MARGIN + inner * 0.4, y, { width: inner * 0.6, align: 'right' });
            doc.y = Math.max(leftBottom, doc.y);
        };

        doc.font('Helvetica-Bold').fontSize(12).text(sale.vendor?.business_name || '', MARGIN, doc.y, { width: inner, align: 'center' });
        doc.font('Helvetica').fontSize(8);
        doc.text(sale.clientstore?.store_name || '', { width: inner, align: 'center' });
        if (sale.clientstore?.address) doc.text(sale.clientstore.address, { width: inner, align: 'center' });
        if (sale.clientstore?.store_phone) doc.text(`Tel: ${sale.clientstore.store_phone}`, { width: inner, align: 'center' });
        if (sale.vendor?.tax_number) doc.text(`Tax No: ${sale.vendor.tax_number}`, { width: inner, align: 'center' });
        line();

        doc.font('Helvetica-Bold').fontSize(10).text('SALES RECEIPT', MARGIN, doc.y, { width: inner, align: 'center' });
        if (sale.status !== 'Completed') {
            doc.font('Helvetica').fontSize(8).text(sale.status.toUpperCase(), { width: inner, align: 'center' });
        }
        doc.moveDown(0.3);
        row('Bill No', sale.bill_number);
        row('Date', moment(sale.created_at).tz(timeZone).format('DD MMM YYYY hh:mm A'));
        row('Cashier', sale.cashier?.full_name || '');
        if (sale.register_session?.session_number) row('Register', sale.register_session.session_number);
        if (sale.customer_name || sale.customer_phone) row('Customer', [sale.customer_name, sale.customer_phone].filter(Boolean).join(' · '));
        line();

        doc.font('Helvetica-Bold').fontSize(8);
        row('Item', 'Amount', { bold: true });
        doc.moveDown(0.2);
        for (const item of sale.items) {
            doc.font('Helvetica-Bold').fontSize(8).text(`${item.product_name} ${item.variant_name}`, MARGIN, doc.y, { width: inner });
            const qty = `${this.quantity(item.quantity)}${item.unit_label ? ` ${item.unit_label}` : ''} x ${this.money(item.unit_price)}`;
            row(qty, this.money(item.quantity * item.unit_price));
            if (item.discount_amount > 0) row('  Discount', `-${this.money(item.discount_amount)}`);
            if (item.returned_quantity > 0) row('  Returned', `${this.quantity(item.returned_quantity)}`);
            doc.moveDown(0.2);
        }
        line();

        row('Lines', String(sale.items.length));
        row('Subtotal', this.money(sale.subtotal));
        if (sale.item_discount > 0) row('Item discounts', `-${this.money(sale.item_discount)}`);
        if (sale.bill_discount > 0) row('Bill discount', `-${this.money(sale.bill_discount)}`);
        const inclusive = sale.items.every((item: any) => item.price_includes_tax);
        row(inclusive ? 'Tax (included)' : 'Tax', this.money(sale.tax_amount));
        doc.moveDown(0.2);
        row('TOTAL', `${currency} ${this.money(sale.total_amount)}`, { bold: true, size: 11 });
        line();

        for (const payment of sale.payments) {
            row(`Paid by ${payment.method}`, this.money(payment.amount));
        }
        if (sale.change_amount > 0) row('Change', this.money(sale.change_amount), { bold: true });
        if (sale.refunded_amount > 0) row('Refunded', `-${this.money(sale.refunded_amount)}`, { bold: true });
        line();

        doc.font('Helvetica').fontSize(8);
        if (sale.note) {
            doc.text(sale.note, MARGIN, doc.y, { width: inner, align: 'center' });
            doc.moveDown(0.3);
        }
        doc.text('Thank you for shopping with us!', MARGIN, doc.y, { width: inner, align: 'center' });
        doc.text('Keep this receipt for returns.', { width: inner, align: 'center' });
        if (sale.print_count > 0) {
            doc.moveDown(0.3);
            doc.fontSize(7).text(`Reprint #${sale.print_count}`, { width: inner, align: 'center' });
        }
    }

    render(res: Response, sale: any) {
        const PDFDocument = require('pdfkit');
        const measure = new PDFDocument({ size: [WIDTH, 5000], margins: { top: 10, left: MARGIN, right: MARGIN, bottom: 10 } });
        this.draw(measure, sale);
        const height = Math.ceil(measure.y + 20);
        measure.end();

        const doc = new PDFDocument({ size: [WIDTH, height], margins: { top: 10, left: MARGIN, right: MARGIN, bottom: 10 } });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=${sale.bill_number}.pdf`);
        doc.pipe(res);
        this.draw(doc, sale);
        doc.end();
    }
}
