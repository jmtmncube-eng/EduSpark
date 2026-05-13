import PDFDocument from 'pdfkit';
import type { Response } from 'express';

/**
 * EduSpark branded PDF renderer.
 *
 * Minimalist white aesthetic with a teal accent:
 *   • Header: 🔬 EduSpark wordmark left, document type chip right, thin teal rule
 *   • Body:   numbered questions, plenty of breathing room, options A B C D
 *   • Memo:   ✓ on correct option, step-by-step solution in indented block
 *   • Footer: page X / Y, brand line, generated date
 */

const COLORS = {
  ink: '#0F172A',     // body text
  muted: '#64748B',   // sub-text
  rule: '#E2E8F0',    // hairlines
  brand: '#0D9488',   // EduSpark teal
  ok: '#16A34A',
  badgeBg: '#F1F5F9',
};

const SIZES = {
  body: 11,
  small: 9,
  h1: 18,
  h2: 13,
};

export interface QuestionForRender {
  question: string;
  options: string[];
  answer: string;
  solution?: string | null;
  topic?: string;
  difficulty?: string;
  imageData?: string | null;
}

export interface PdfRenderOptions {
  title: string;            // e.g. pack title
  subtitle?: string;        // grade / subject / topic
  mode: 'worksheet' | 'memo';
  questions: QuestionForRender[];
  authorName?: string;      // teacher's name
  schoolName?: string;
}

/**
 * Stream a branded PDF to the given response.
 */
export function renderPackPdf(res: Response, opts: PdfRenderOptions): void {
  const filename = `${opts.title.replace(/[^a-zA-Z0-9._-]/g, '_')}_${opts.mode}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 64, bottom: 64, left: 56, right: 56 },
    autoFirstPage: false,
    bufferPages: true, // needed so we can paginate the footer counts
    info: {
      Title: `${opts.title} — ${opts.mode === 'memo' ? 'Memo' : 'Worksheet'}`,
      Author: 'EduSpark',
      Creator: 'EduSpark',
      Producer: 'EduSpark',
    },
  });

  doc.pipe(res);
  doc.addPage();
  drawHeader(doc, opts);

  // ─── Title block ──────────────────────────────────────────────
  doc.moveDown(0.6);
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(SIZES.h1).text(opts.title);
  if (opts.subtitle) {
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(SIZES.body).text(opts.subtitle);
  }

  // Student name strip (worksheet only)
  if (opts.mode === 'worksheet') {
    doc.moveDown(0.8);
    drawStudentStrip(doc);
  }

  doc.moveDown(0.8);

  // ─── Questions ────────────────────────────────────────────────
  opts.questions.forEach((q, i) => {
    ensureRoom(doc, 120);
    drawQuestion(doc, q, i + 1, opts.mode);
    doc.moveDown(opts.mode === 'memo' ? 0.6 : 1.2);
  });

  // ─── Footer + page numbers ────────────────────────────────────
  drawFooterAndPaginate(doc, opts);

  doc.end();
}

// ─── Header ──────────────────────────────────────────────────────
function drawHeader(doc: PDFKit.PDFDocument, opts: PdfRenderOptions): void {
  const top = 32;
  // Brand wordmark left
  doc
    .fillColor(COLORS.brand)
    .font('Helvetica-Bold').fontSize(14)
    .text('EduSpark', 56, top, { lineBreak: false });
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica').fontSize(SIZES.small)
    .text('Maths & Science', 56, top + 16, { lineBreak: false });

  // Mode chip right
  const chip = opts.mode === 'memo' ? 'MEMO' : 'WORKSHEET';
  const chipW = doc.widthOfString(chip) + 18;
  const chipX = doc.page.width - 56 - chipW;
  doc
    .roundedRect(chipX, top, chipW, 18, 9)
    .fillAndStroke(COLORS.badgeBg, COLORS.rule);
  doc
    .fillColor(COLORS.brand)
    .font('Helvetica-Bold').fontSize(SIZES.small)
    .text(chip, chipX, top + 5, { width: chipW, align: 'center', lineBreak: false });

  // Hairline rule
  doc.moveTo(56, top + 32).lineTo(doc.page.width - 56, top + 32).strokeColor(COLORS.brand).lineWidth(1.4).stroke();
  doc.strokeColor(COLORS.rule).lineWidth(0.5);

  // Cursor under the rule
  doc.x = 56;
  doc.y = top + 44;
}

// ─── Student strip ───────────────────────────────────────────────
function drawStudentStrip(doc: PDFKit.PDFDocument): void {
  const fields = ['Name', 'Class', 'Date'];
  const totalW = doc.page.width - 56 - 56;
  const colW = (totalW - 16) / fields.length;
  const startX = 56;
  let cursorY = doc.y;
  doc.font('Helvetica').fontSize(SIZES.small).fillColor(COLORS.muted);
  fields.forEach((label, i) => {
    const x = startX + i * (colW + 8);
    doc.text(`${label}:`, x, cursorY, { width: colW, lineBreak: false });
    doc.moveTo(x + 38, cursorY + 12).lineTo(x + colW, cursorY + 12).strokeColor(COLORS.rule).stroke();
  });
  doc.y = cursorY + 22;
  doc.x = 56;
}

// ─── A question ──────────────────────────────────────────────────
function drawQuestion(doc: PDFKit.PDFDocument, q: QuestionForRender, num: number, mode: 'worksheet' | 'memo'): void {
  const startY = doc.y;
  doc.x = 56;

  // Number circle
  const cx = 64, cy = startY + 6;
  doc.roundedRect(56, startY, 24, 18, 4).fillAndStroke(COLORS.brand, COLORS.brand);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(SIZES.small).text(`Q${num}`, 56, cy - 2, { width: 24, align: 'center', lineBreak: false });

  // Topic/difficulty meta (right)
  if (q.topic || q.difficulty) {
    const meta = [q.topic, q.difficulty ? capitalize(q.difficulty) : null].filter(Boolean).join(' · ');
    doc
      .fillColor(COLORS.muted).font('Helvetica').fontSize(SIZES.small)
      .text(meta, 56, startY + 2, { width: doc.page.width - 56 - 56, align: 'right', lineBreak: false });
  }

  // Question text
  doc.x = 86;
  doc.y = startY;
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(SIZES.body)
    .text(q.question, 86, startY, { width: doc.page.width - 56 - 86 });
  doc.moveDown(0.4);

  // Options
  if (q.options && q.options.length > 0) {
    q.options.forEach((opt, i) => {
      const letter = String.fromCharCode(65 + i);
      const isCorrect = mode === 'memo' && opt === q.answer;
      const optY = doc.y;
      doc.x = 86;
      // marker square
      const markerSize = 11;
      if (isCorrect) {
        doc.roundedRect(86, optY + 2, markerSize, markerSize, 2).fillAndStroke(COLORS.ok, COLORS.ok);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(SIZES.small).text('✓', 86, optY + 1, { width: markerSize, align: 'center', lineBreak: false });
      } else {
        doc.roundedRect(86, optY + 2, markerSize, markerSize, 2).strokeColor(COLORS.rule).lineWidth(0.8).stroke();
      }
      doc.fillColor(isCorrect ? COLORS.ok : COLORS.ink).font(isCorrect ? 'Helvetica-Bold' : 'Helvetica').fontSize(SIZES.body)
        .text(`${letter}.  ${opt}`, 86 + markerSize + 8, optY, { width: doc.page.width - 56 - 86 - markerSize - 8 });
      doc.moveDown(0.15);
    });
  } else if (mode === 'worksheet') {
    // Free-text answer space
    for (let i = 0; i < 3; i++) {
      const lineY = doc.y + 10;
      doc.moveTo(86, lineY).lineTo(doc.page.width - 56, lineY).strokeColor(COLORS.rule).lineWidth(0.5).stroke();
      doc.y = lineY + 4;
    }
  }

  // Memo: solution
  if (mode === 'memo') {
    doc.moveDown(0.3);
    const solY = doc.y;
    doc.rect(86, solY, doc.page.width - 56 - 86, 0); // anchor
    doc.fillColor(COLORS.brand).font('Helvetica-Bold').fontSize(SIZES.small).text('Solution', 86, solY, { lineBreak: true });
    if (q.solution) {
      doc.fillColor(COLORS.ink).font('Helvetica').fontSize(SIZES.body);
      q.solution.split('\n').forEach((line) => {
        if (!line.trim()) return;
        doc.text(line.trim(), 96, doc.y, { width: doc.page.width - 56 - 96 });
      });
    } else {
      doc.fillColor(COLORS.muted).font('Helvetica-Oblique').fontSize(SIZES.body).text('(no solution provided)', 96, doc.y);
    }
  }
}

// ─── Footer + page numbers ───────────────────────────────────────
function drawFooterAndPaginate(doc: PDFKit.PDFDocument, opts: PdfRenderOptions): void {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - 40;
    doc.moveTo(56, y - 8).lineTo(doc.page.width - 56, y - 8).strokeColor(COLORS.rule).lineWidth(0.5).stroke();

    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(SIZES.small);
    const left = [opts.authorName, opts.schoolName].filter(Boolean).join(' · ') || 'EduSpark · eduspark.app';
    doc.text(left, 56, y, { lineBreak: false });

    const right = `Page ${i + 1} of ${total}`;
    doc.text(right, doc.page.width - 56 - 120, y, { width: 120, align: 'right', lineBreak: false });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────
function ensureRoom(doc: PDFKit.PDFDocument, neededHeight: number): void {
  const bottomMargin = 80;
  if (doc.y + neededHeight > doc.page.height - bottomMargin) {
    doc.addPage();
    // Re-draw header on continuation pages: tiny brand strip only
    doc.fillColor(COLORS.brand).font('Helvetica-Bold').fontSize(10).text('EduSpark', 56, 36, { lineBreak: false });
    doc.moveTo(56, 56).lineTo(doc.page.width - 56, 56).strokeColor(COLORS.rule).lineWidth(0.5).stroke();
    doc.x = 56; doc.y = 64;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
