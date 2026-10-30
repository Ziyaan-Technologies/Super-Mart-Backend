import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as moment from 'moment-timezone';

export interface ExportColumn {
    header: string;
    key: string;
    width?: number;
    value?: (row: any) => any;
    pdf?: boolean;
}

@Injectable()
export class ExportService {
    private cellValue(column: ExportColumn, row: any) {
        const raw = column.value ? column.value(row) : row[column.key];
        if (raw === null || raw === undefined || raw === '') {
            return 'N/A';
        }
        if (raw instanceof Date) {
            return moment(raw).format('YYYY-MM-DD HH:mm:ss');
        }
        if (typeof raw === 'boolean') {
            return raw ? 'Active' : 'Inactive';
        }
        return raw;
    }

    async excel(res: Response, title: string, columns: ExportColumn[], rows: any[]) {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`${title} Data`);
        worksheet.columns = columns.map((column) => ({
            header: column.header,
            key: column.key,
            width: column.width || 20,
        }));
        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell((cell: any) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA6A6A6' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        rows.forEach((row) => {
            const line: any = {};
            columns.forEach((column) => {
                line[column.key] = this.cellValue(column, row);
            });
            worksheet.addRow(line);
        });
        const fileName = title.replace(/\s+/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}_export.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    }

    pdf(res: Response, title: string, allColumns: ExportColumn[], rows: any[]) {
        const PDFDocument = require('pdfkit');
        const columns = allColumns.filter((column) => column.pdf !== false);
        const landscape = columns.length > 6;
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: landscape ? 'landscape' : 'portrait' });
        const fileName = title.replace(/\s+/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}_export.pdf`);
        doc.pipe(res);
        doc.fontSize(16).font('Helvetica-Bold').text(`${title} Report`, { align: 'center' });
        doc.moveDown(1);
        const usableWidth = doc.page.width - 60;
        const totalWeight = columns.reduce((sum, column) => sum + (column.width || 20), 0);
        const widths = columns.map((column) => (usableWidth * (column.width || 20)) / totalWeight);
        const offsets = widths.map((_, i) => 30 + widths.slice(0, i).reduce((sum, w) => sum + w, 0));
        const bottomLimit = doc.page.height - 40;
        const drawHeader = (y: number) => {
            doc.font('Helvetica-Bold').fontSize(9);
            const height = Math.max(...columns.map((column, i) => doc.heightOfString(column.header, { width: widths[i] - 4 })));
            columns.forEach((column, i) => {
                doc.text(column.header, offsets[i], y, { width: widths[i] - 4 });
            });
            doc.moveTo(30, y + height + 3).lineTo(30 + usableWidth, y + height + 3).stroke();
            doc.font('Helvetica').fontSize(8);
            return y + height + 8;
        };
        let y = drawHeader(doc.y);
        rows.forEach((row) => {
            const values = columns.map((column) => String(this.cellValue(column, row)));
            const height = Math.max(...values.map((value, i) => doc.heightOfString(value, { width: widths[i] - 4 })));
            if (y + height > bottomLimit) {
                doc.addPage();
                y = drawHeader(30);
            }
            values.forEach((value, i) => {
                doc.text(value, offsets[i], y, { width: widths[i] - 4 });
            });
            y += height + 6;
        });
        doc.end();
    }
}
