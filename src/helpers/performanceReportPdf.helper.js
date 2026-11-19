import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGO_PATH = path.resolve(__dirname, '../assets/z7i_logo.png');

const sanitizePart = (val, fallback = 'NA') => {
  const cleaned = String(val || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
};

export const buildPerformanceReportFilename = (studentName, regNo) => {
  const namePart = sanitizePart(studentName, 'Student');
  const regPart = sanitizePart(regNo, 'RegNo');
  return `${namePart}_${regPart}.pdf`;
};

export const generatePerformanceReportPdfBuffer = (reportData) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const ml = 40;
      const mr = 40;
      const contentW = pageW - ml - mr;

      // Top-right Z7i logo in header (larger, with header line close below)
      const logoW = 165;
      let lineY = 68;
      if (fs.existsSync(LOGO_PATH)) {
        try {
          doc.image(LOGO_PATH, pageW - mr - logoW, 20, { width: logoW });
          lineY = 66;
        } catch {
          lineY = 56;
        }
      }

      doc
        .moveTo(ml, lineY)
        .lineTo(pageW - mr, lineY)
        .lineWidth(1)
        .strokeColor('#333333')
        .stroke();

      // Heading below the header: Academic Performance Report
      let y = lineY + 12;
      doc
        .font('Helvetica-Bold')
        .fontSize(15)
        .fillColor('#111111')
        .text('Academic Performance Report', ml, y, {
          width: contentW,
          align: 'center'
        });

      // Student Details sub-heading on the left side
      y = doc.y + 10;
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#111111')
        .text('Student Details', ml, y, {
          width: contentW,
          align: 'left'
        });

      // Student Details — aligned colons with close values
      y = doc.y + 8;
      const detailRows = [
        ['Name', reportData.studentName || '-'],
        ['Enrollment No', reportData.enrollmentNo || '-'],
        ['Batch Name', reportData.batchName || '-'],
        ['Program', reportData.programName || '-']
      ];

      const labelW = 88;
      const colonX = ml + labelW;
      const valueX = colonX + 10;

      for (const [label, value] of detailRows) {
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#111111').text(label, ml, y, { width: labelW });
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#111111').text(':', colonX, y, { width: 8 });
        doc.font('Helvetica').fontSize(10.5).fillColor('#222222').text(String(value), valueX, y, { width: contentW - (valueX - ml) });
        y += 18;
      }

      // Score Card heading
      y += 14;
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#111111')
        .text('Score Card', ml, y, {
          width: contentW,
          align: 'center'
        });

      // Exam Name below Score Card on the left side
      y = doc.y + 10;
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#111111')
        .text(`Exam Name: ${reportData.examName || 'Exam Performance'}`, ml, y, {
          width: contentW,
          align: 'left'
        });
      y = doc.y + 10;

      // Grid: Subject | Your Marks | Out of | Highest | Average
      // Header row and Total row in bold; all data rows in normal weight
      const colWidths = [
        Math.round(contentW * 0.28),
        Math.round(contentW * 0.18),
        Math.round(contentW * 0.18),
        Math.round(contentW * 0.18),
        contentW -
          Math.round(contentW * 0.28) -
          Math.round(contentW * 0.18) -
          Math.round(contentW * 0.18) -
          Math.round(contentW * 0.18)
      ];
      const headers = ['Subject', 'Your Marks', 'Out of', 'Highest', 'Average'];
      const rowH = 26;

      const drawRow = (cells, rowY, { isHeader = false, isTotal = false } = {}) => {
        let x = ml;
        doc.lineWidth(0.8).strokeColor('#000000');
        const useBold = isHeader || isTotal;
        for (let i = 0; i < cells.length; i++) {
          const w = colWidths[i];
          const textVal = String(cells[i] ?? '');
          const isAbCell = !isHeader && i === 1 && textVal.trim().toUpperCase() === 'AB';
          doc.rect(x, rowY, w, rowH).stroke();
          doc
            .font(useBold || isAbCell ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(10)
            .fillColor(isAbCell ? '#dc2626' : '#000000')
            .text(textVal, x + 6, rowY + 8, {
              width: w - 12,
              align: 'center',
              lineBreak: false,
              ellipsis: true
            });
          x += w;
        }
      };

      drawRow(headers, y, { isHeader: true });
      y += rowH;

      const rows = Array.isArray(reportData.rows) ? reportData.rows : [];
      for (const r of rows) {
        drawRow([r.subject, r.yourMarks, r.outOf, r.highest, r.average], y);
        y += rowH;
      }

      const tot = reportData.total || { yourMarks: 0, outOf: 0, highest: 0, average: 0 };
      drawRow(['Total', tot.yourMarks, tot.outOf, tot.highest, tot.average], y, { isTotal: true });

      // Regards footer
      y += rowH + 24;
      doc.font('Helvetica').fontSize(10.5).fillColor('#222222').text('Regards,', ml, y);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#111111').text('Team Z7i', ml, y + 15);
      doc.font('Helvetica').fontSize(10.5).fillColor('#222222').text('Coimbatore', ml, y + 30);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
