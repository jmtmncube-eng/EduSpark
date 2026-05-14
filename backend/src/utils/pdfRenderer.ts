import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import type { Response } from 'express';

/**
 * EduSpark branded PDF renderer.
 *
 * Minimalist white aesthetic with a teal accent:
 *   • Header: EduSpark wordmark left, document type chip right, thin teal rule
 *   • Body:   numbered questions, a diagram where the question carries one,
 *             plenty of breathing room, options A B C D
 *   • Memo:   check on correct option, step-by-step solution in indented block
 *   • Footer: page X / Y, brand line
 *
 * Fonts: the standard PDF fonts (Helvetica) only cover WinAnsi, so the minus
 * sign (−), Greek letters (θ, Δ, Σ, λ, Ω), sub/superscripts and arrows that
 * Maths & Science content is full of all rendered as garbage. We embed
 * DejaVu Sans (broad Unicode coverage) so the maths comes out correct.
 */

// ─── Embedded Unicode fonts ──────────────────────────────────────
// DejaVu Sans covers the Greek + maths + arrow glyphs our generators emit.
// Resolved from the `dejavu-fonts-ttf` dependency so it ships in dev and in
// the production Docker image alike (it's a runtime `dependency`).
const FONT = { body: 'EduBody', bold: 'EduBold', oblique: 'EduOblique' };

let FONT_PATHS: { body: string; bold: string; oblique: string } | null = null;
try {
  // require.resolve works because the backend is compiled to CommonJS.
  FONT_PATHS = {
    body: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf'),
    bold: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf'),
    oblique: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Oblique.ttf'),
  };
} catch {
  FONT_PATHS = null;
}

/** Register the embedded fonts on a fresh document (falls back to Helvetica). */
function installFonts(doc: PDFKit.PDFDocument): { body: string; bold: string; oblique: string } {
  if (FONT_PATHS) {
    try {
      doc.registerFont(FONT.body, FONT_PATHS.body);
      doc.registerFont(FONT.bold, FONT_PATHS.bold);
      doc.registerFont(FONT.oblique, FONT_PATHS.oblique);
      return FONT;
    } catch {
      /* fall through to the standard fonts */
    }
  }
  return { body: 'Helvetica', bold: 'Helvetica-Bold', oblique: 'Helvetica-Oblique' };
}

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

// Diagram display box (points). SVG diagrams are authored at 360×220.
const DIAGRAM = { width: 230, height: Math.round(230 * 220 / 360) }; // ≈ 140

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

// Fonts resolved per-document, threaded through the draw helpers.
type Fonts = { body: string; bold: string; oblique: string };

/**
 * Strip characters the embedded font genuinely cannot draw — colour emoji and
 * other pictographs. Everything our Maths/Science generators emit (−, ×, ÷, √,
 * ≤, ≥, ≠, Greek, arrows, sub/superscripts) IS covered by DejaVu Sans, so we
 * only remove the pictographic ranges that would otherwise render as tofu /
 * mojibake (e.g. a 📝 in a teacher-typed pack title).
 */
function clean(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu,
      '',
    )
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** SVG data-URI → crisp PNG buffer, or null if it can't be rasterised. */
async function rasterizeDiagram(dataUri?: string | null): Promise<Buffer | null> {
  if (!dataUri) return null;
  const m = /^data:image\/svg\+xml;base64,(.+)$/i.exec(dataUri);
  if (!m) return null;
  try {
    const svg = Buffer.from(m[1], 'base64');
    // density bumps the raster resolution so the diagram stays sharp in print.
    return await sharp(svg, { density: 220 }).png().toBuffer();
  } catch {
    return null;
  }
}

/**
 * Stream a branded PDF to the given response. Async because question diagrams
 * (stored as SVG) are rasterised up-front before the synchronous pdfkit pass.
 */
export async function renderPackPdf(res: Response, opts: PdfRenderOptions): Promise<void> {
  const filename = `${opts.title.replace(/[^a-zA-Z0-9._-]/g, '_')}_${opts.mode}.pdf`;

  // Rasterise every diagram before we start streaming the document.
  const diagrams = await Promise.all(
    opts.questions.map((q) => rasterizeDiagram(q.imageData)),
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 64, bottom: 64, left: 56, right: 56 },
    autoFirstPage: false,
    bufferPages: true, // needed so we can paginate the footer counts
    info: {
      Title: `${clean(opts.title)} — ${opts.mode === 'memo' ? 'Memo' : 'Worksheet'}`,
      Author: 'EduSpark',
      Creator: 'EduSpark',
      Producer: 'EduSpark',
    },
  });

  const fonts = installFonts(doc);

  doc.pipe(res);
  doc.addPage();
  drawHeader(doc, opts, fonts);

  // ─── Title block ──────────────────────────────────────────────
  doc.moveDown(0.6);
  doc.fillColor(COLORS.ink).font(fonts.bold).fontSize(SIZES.h1).text(clean(opts.title) || 'Untitled');
  if (opts.subtitle) {
    doc.fillColor(COLORS.muted).font(fonts.body).fontSize(SIZES.body).text(clean(opts.subtitle));
  }

  // Student name strip (worksheet only)
  if (opts.mode === 'worksheet') {
    doc.moveDown(0.8);
    drawStudentStrip(doc, fonts);
  }

  doc.moveDown(0.8);

  // ─── Questions ────────────────────────────────────────────────
  opts.questions.forEach((q, i) => {
    const diagram = diagrams[i];
    ensureRoom(doc, 120 + (diagram ? DIAGRAM.height + 14 : 0), fonts);
    drawQuestion(doc, q, i + 1, opts.mode, fonts, diagram);
    doc.moveDown(opts.mode === 'memo' ? 0.6 : 1.2);
  });

  // ─── Footer + page numbers ────────────────────────────────────
  drawFooterAndPaginate(doc, opts, fonts);

  doc.end();
}

// ─── Header ──────────────────────────────────────────────────────
function drawHeader(doc: PDFKit.PDFDocument, opts: PdfRenderOptions, fonts: Fonts): void {
  const top = 32;
  // Brand wordmark left
  doc
    .fillColor(COLORS.brand)
    .font(fonts.bold).fontSize(14)
    .text('EduSpark', 56, top, { lineBreak: false });
  doc
    .fillColor(COLORS.muted)
    .font(fonts.body).fontSize(SIZES.small)
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
    .font(fonts.bold).fontSize(SIZES.small)
    .text(chip, chipX, top + 5, { width: chipW, align: 'center', lineBreak: false });

  // Hairline rule
  doc.moveTo(56, top + 32).lineTo(doc.page.width - 56, top + 32).strokeColor(COLORS.brand).lineWidth(1.4).stroke();
  doc.strokeColor(COLORS.rule).lineWidth(0.5);

  // Cursor under the rule
  doc.x = 56;
  doc.y = top + 44;
}

// ─── Student strip ───────────────────────────────────────────────
function drawStudentStrip(doc: PDFKit.PDFDocument, fonts: Fonts): void {
  const fields = ['Name', 'Class', 'Date'];
  const totalW = doc.page.width - 56 - 56;
  const colW = (totalW - 16) / fields.length;
  const startX = 56;
  const cursorY = doc.y;
  doc.font(fonts.body).fontSize(SIZES.small).fillColor(COLORS.muted);
  fields.forEach((label, i) => {
    const x = startX + i * (colW + 8);
    doc.text(`${label}:`, x, cursorY, { width: colW, lineBreak: false });
    doc.moveTo(x + 38, cursorY + 12).lineTo(x + colW, cursorY + 12).strokeColor(COLORS.rule).stroke();
  });
  doc.y = cursorY + 22;
  doc.x = 56;
}

// ─── A question ──────────────────────────────────────────────────
function drawQuestion(
  doc: PDFKit.PDFDocument,
  q: QuestionForRender,
  num: number,
  mode: 'worksheet' | 'memo',
  fonts: Fonts,
  diagram: Buffer | null,
): void {
  const startY = doc.y;
  doc.x = 56;

  // Number chip
  const cy = startY + 6;
  doc.roundedRect(56, startY, 24, 18, 4).fillAndStroke(COLORS.brand, COLORS.brand);
  doc.fillColor('#FFFFFF').font(fonts.bold).fontSize(SIZES.small).text(`Q${num}`, 56, cy - 2, { width: 24, align: 'center', lineBreak: false });

  // Topic/difficulty meta (right)
  if (q.topic || q.difficulty) {
    const meta = [q.topic, q.difficulty ? capitalize(q.difficulty) : null].filter(Boolean).join(' · ');
    doc
      .fillColor(COLORS.muted).font(fonts.body).fontSize(SIZES.small)
      .text(clean(meta), 56, startY + 2, { width: doc.page.width - 56 - 56, align: 'right', lineBreak: false });
  }

  // Question text
  doc.x = 86;
  doc.y = startY;
  doc.fillColor(COLORS.ink).font(fonts.bold).fontSize(SIZES.body)
    .text(clean(q.question), 86, startY, { width: doc.page.width - 56 - 86 });
  doc.moveDown(0.4);

  // Diagram (when the question carries one) — neatly framed, indented
  if (diagram) {
    const imgY = doc.y + 2;
    try {
      doc.image(diagram, 86, imgY, { fit: [DIAGRAM.width, DIAGRAM.height] });
      doc.roundedRect(86, imgY, DIAGRAM.width, DIAGRAM.height, 6)
        .strokeColor(COLORS.rule).lineWidth(0.8).stroke();
    } catch {
      /* if the buffer is somehow unusable, just skip the picture */
    }
    doc.y = imgY + DIAGRAM.height + 8;
    doc.x = 86;
  }

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
        doc.fillColor('#FFFFFF').font(fonts.bold).fontSize(SIZES.small).text('✓', 86, optY + 1, { width: markerSize, align: 'center', lineBreak: false });
      } else {
        doc.roundedRect(86, optY + 2, markerSize, markerSize, 2).strokeColor(COLORS.rule).lineWidth(0.8).stroke();
      }
      doc.fillColor(isCorrect ? COLORS.ok : COLORS.ink).font(isCorrect ? fonts.bold : fonts.body).fontSize(SIZES.body)
        .text(`${letter}.  ${clean(opt)}`, 86 + markerSize + 8, optY, { width: doc.page.width - 56 - 86 - markerSize - 8 });
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
    doc.fillColor(COLORS.brand).font(fonts.bold).fontSize(SIZES.small).text('Solution', 86, solY, { lineBreak: true });
    if (q.solution) {
      doc.fillColor(COLORS.ink).font(fonts.body).fontSize(SIZES.body);
      clean(q.solution).split('\n').forEach((line) => {
        if (!line.trim()) return;
        doc.text(line.trim(), 96, doc.y, { width: doc.page.width - 56 - 96 });
      });
    } else {
      doc.fillColor(COLORS.muted).font(fonts.oblique).fontSize(SIZES.body).text('(no solution provided)', 96, doc.y);
    }
  }
}

// ─── Footer + page numbers ───────────────────────────────────────
function drawFooterAndPaginate(doc: PDFKit.PDFDocument, opts: PdfRenderOptions, fonts: Fonts): void {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - 40;
    doc.moveTo(56, y - 8).lineTo(doc.page.width - 56, y - 8).strokeColor(COLORS.rule).lineWidth(0.5).stroke();

    doc.fillColor(COLORS.muted).font(fonts.body).fontSize(SIZES.small);
    const left = [clean(opts.authorName), clean(opts.schoolName)].filter(Boolean).join(' · ') || 'EduSpark · eduspark.app';
    doc.text(left, 56, y, { lineBreak: false });

    const right = `Page ${i + 1} of ${total}`;
    doc.text(right, doc.page.width - 56 - 120, y, { width: 120, align: 'right', lineBreak: false });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────
function ensureRoom(doc: PDFKit.PDFDocument, neededHeight: number, fonts: Fonts): void {
  const bottomMargin = 80;
  if (doc.y + neededHeight > doc.page.height - bottomMargin) {
    doc.addPage();
    // Re-draw header on continuation pages: tiny brand strip only
    doc.fillColor(COLORS.brand).font(fonts.bold).fontSize(10).text('EduSpark', 56, 36, { lineBreak: false });
    doc.moveTo(56, 56).lineTo(doc.page.width - 56, 56).strokeColor(COLORS.rule).lineWidth(0.5).stroke();
    doc.x = 56; doc.y = 64;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
