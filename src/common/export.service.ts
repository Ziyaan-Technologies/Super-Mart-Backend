import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as moment from 'moment-timezone';

export interface ExportColumn {
    header: string;
    key: string;
    width?: number;
    value?: (row: any) => any;
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

    pdf(res: Response, title: string, columns: ExportColumn[], rows: any[]) {
        const PDFDocument = require('pdfkit');
        const landscape = columns.length > 6;
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: landscape ? 'landscape' : 'portrait' });
        const fileName = title.replace(/\s+/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}_export.pdf`);
        doc.pipe(res);
        doc.fontSize(16).font('Helvetica-Bold').text(`${title} Report`, { align: 'center' });
        doc.moveDown(1);
        const usableWidth = doc.page.width - 60;
        const colWidth = usableWidth / columns.length;
        const bottomLimit = doc.page.height - 50;
        const drawHeader = (y: number) => {
            doc.font('Helvetica-Bold').fontSize(9);
            columns.forEach((column, i) => {
                doc.text(column.header, 30 + i * colWidth, y, { width: colWidth - 4 });
            });
            doc.moveTo(30, y + 15).lineTo(30 + usableWidth, y + 15).stroke();
            return y + 20;
        };
        let y = drawHeader(doc.y);
        doc.font('Helvetica').fontSize(8);
        rows.forEach((row) => {
            if (y > bottomLimit) {
                doc.addPage();
                y = drawHeader(30);
                doc.font('Helvetica').fontSize(8);
            }
            columns.forEach((column, i) => {
                doc.text(String(this.cellValue(column, row)), 30 + i * colWidth, y, { width: colWidth - 4, height: 14, ellipsis: true });
            });
            y += 18;
        });
        doc.end();
    }
}
