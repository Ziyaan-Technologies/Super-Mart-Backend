import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as moment from 'moment-timezone';
import { existsSync } from 'fs';
import { join } from 'path';

// 80mm thermal paper prints a 72mm (204pt) wide area; matching it exactly stops the
// print dialog from rescaling the page, which shifts everything off-centre.
const WIDTH = 204;
const MARGIN = 4;
const LOGO_WIDTH = 120;
const LOGO_MAX_HEIGHT = 70;
// Thin strokes print faint on thermal heads, so the receipt uses bold text throughout.
const FONT = 'Helvetica-Bold';
const SIZE = 9;

@Injectable()
export class ReceiptService {
    private money(value: number) {
        return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    private quantity(value: number) {
        return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
    }

    // Logos are uploaded to this server, so read them from disk instead of over HTTP.
    private logoPath(logoUrl?: string | null): string | null {
        const marker = '/uploads/';
        const index = logoUrl?.indexOf(marker) ?? -1;
        if (index < 0) {
            return null;
        }
        const path = join(process.cwd(), 'uploads', decodeURIComponent(logoUrl.slice(index + marker.length).split('?')[0]));
        return existsSync(path) ? path : null;
    }

    private drawLogo(doc: any, path: string | null): boolean {
        if (!path) {
            return false;
        }
        try {
            const image = doc.openImage(path);
            const scale = Math.min(LOGO_WIDTH / image.width, LOGO_MAX_HEIGHT / image.height);
            const width = image.width * scale;
            const height = image.height * scale;
            doc.image(image, (WIDTH - width) / 2, doc.y, { width, height });
            doc.y += height + 4;
            return true;
        } catch {
            return false;
        }
    }

    private draw(doc: any, sale: any) {
        const inner = WIDTH - MARGIN * 2;
        const currency = sale.vendor?.country?.currency_symbol || sale.vendor?.country?.currency_short_name || '';
        const timeZone = sale.vendor?.country?.country_time_zone || 'Asia/Karachi';
        const line = () => {
            doc.moveDown(0.3);
            doc.moveTo(MARGIN, doc.y).lineTo(WIDTH - MARGIN, doc.y).lineWidth(1).stroke();
            doc.moveDown(0.4);
        };
        const row = (left: string, right: string, options: { size?: number } = {}) => {
            doc.font(FONT).fontSize(options.size || SIZE);
            const y = doc.y;
            doc.text(left, MARGIN, y, { width: inner * 0.6 });
            const leftBottom = doc.y;
            doc.text(right, MARGIN + inner * 0.4, y, { width: inner * 0.6, align: 'right' });
            doc.y = Math.max(leftBottom, doc.y);
        };

        // the branch's own logo comes first; the business one is the fallback
        const logo = this.logoPath(sale.clientstore?.image_url) || this.logoPath(sale.vendor?.logo_url);
        // The logo already carries the business name, so the name is only printed without one.
        if (!this.drawLogo(doc, logo)) {
            doc.font(FONT).fontSize(14).text(sale.vendor?.business_name || '', MARGIN, doc.y, { width: inner, align: 'center' });
        }
        doc.font(FONT).fontSize(SIZE);
        doc.text(sale.clientstore?.store_name || '', MARGIN, doc.y, { width: inner, align: 'center' });
        if (sale.clientstore?.address) doc.text(sale.clientstore.address, { width: inner, align: 'center' });
        if (sale.clientstore?.store_phone) doc.text(`Tel: ${sale.clientstore.store_phone}`, { width: inner, align: 'center' });
        if (sale.vendor?.tax_number) doc.text(`Tax No: ${sale.vendor.tax_number}`, { width: inner, align: 'center' });
        line();

        doc.font(FONT).fontSize(12).text('SALES RECEIPT', MARGIN, doc.y, { width: inner, align: 'center' });
        if (sale.status !== 'Completed') {
            doc.font(FONT).fontSize(SIZE).text(sale.status.toUpperCase(), { width: inner, align: 'center' });
        }
        doc.moveDown(0.3);
        row('Bill No', sale.bill_number);
        row('Date', moment(sale.created_at).tz(timeZone).format('DD MMM YYYY hh:mm A'));
        row('Cashier', sale.cashier?.full_name || '');
        if (sale.register_session?.session_number) row('Register', sale.register_session.session_number);
        if (sale.customer_name || sale.customer_phone) row('Customer', [sale.customer_name, sale.customer_phone].filter(Boolean).join(' · '));
        line();

        row('Item', 'Amount');
        doc.moveDown(0.2);
        for (const item of sale.items) {
            doc.font(FONT).fontSize(SIZE).text(`${item.product_name} ${item.variant_name}`, MARGIN, doc.y, { width: inner });
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
        row('TOTAL', `${currency} ${this.money(sale.total_amount)}`, { size: 13 });
        line();

        for (const payment of sale.payments) {
            row(`Paid by ${payment.method}${payment.bank_name ? ` (${payment.bank_name})` : ''}`, this.money(payment.amount));
        }
        if (sale.change_amount > 0) row('Change', this.money(sale.change_amount));
        if (sale.refunded_amount > 0) row('Refunded', `-${this.money(sale.refunded_amount)}`);
        line();

        doc.font(FONT).fontSize(SIZE);
        if (sale.note) {
            doc.text(sale.note, MARGIN, doc.y, { width: inner, align: 'center' });
            doc.moveDown(0.3);
        }
        doc.text('Thank you for shopping with us!', MARGIN, doc.y, { width: inner, align: 'center' });
        doc.text('Keep this receipt for returns.', { width: inner, align: 'center' });
        if (sale.print_count > 0) {
            doc.moveDown(0.3);
            doc.fontSize(8).text(`Reprint #${sale.print_count}`, { width: inner, align: 'center' });
        }
        line();
        doc.font(FONT).fontSize(7.5);
        doc.text('Software Developed by Ziyaan Technologies.', MARGIN, doc.y, { width: inner, align: 'center' });
        doc.text('Contact: 03172532083', { width: inner, align: 'center' });
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
