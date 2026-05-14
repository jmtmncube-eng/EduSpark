import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import prisma from './client';

/**
 * Mock-PDF seed (idempotent) — drops a handful of real, openable PDF files
 * into the backend `uploads/` directory and registers them as PdfDocument
 * rows so the Library tab has something to preview, attach to packs, and
 * test the download flow with.
 *
 * Lives in src/db so the normal `tsc` build compiles it to
 * `dist/db/seed-pdfs.js` — which means it runs in the production container
 * with plain `node` (no tsx needed):
 *
 *   docker compose exec backend npm run db:seed-pdfs
 *   # or directly:
 *   docker compose exec backend node dist/db/seed-pdfs.js
 *
 * Re-runnable safely: each document is keyed by title — if the row already
 * exists (and its file is on disk) it is skipped.
 */

// Mirrors UPLOAD_DIR in src/routes/documents.ts. From dist/db (prod) or
// src/db (tsx dev) this resolves to <backend>/uploads either way.
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

interface MockDoc {
  title: string;
  description: string;
  documentKind: 'practice' | 'test' | 'notes';
  /** Each entry is a page: a heading + body lines. */
  pages: { heading: string; lines: string[] }[];
}

const MOCKS: MockDoc[] = [
  {
    title: 'Grade 10 Algebra — Practice Worksheet',
    description: 'Twelve graded practice problems on linear equations and factorisation. Use for homework or a warm-up.',
    documentKind: 'practice',
    pages: [
      {
        heading: 'Grade 10 Mathematics · Algebra Practice',
        lines: [
          'Section A — Solve for x',
          '1.  2x + 5 = 17',
          '2.  3(x - 4) = 9',
          '3.  5x - 7 = 2x + 8',
          '4.  x/3 + 2 = 6',
          '',
          'Section B — Factorise fully',
          '5.  x^2 + 7x + 12',
          '6.  x^2 - 9',
          '7.  2x^2 + 8x',
          '8.  x^2 - 5x - 14',
          '',
          'Section C — Word problems',
          '9.  The sum of a number and 8 is 21. Find the number.',
          '10. A rectangle is 3 cm longer than it is wide and has',
          '    a perimeter of 26 cm. Find its dimensions.',
        ],
      },
      {
        heading: 'Memorandum',
        lines: [
          '1.  x = 6        2.  x = 7',
          '3.  x = 5        4.  x = 12',
          '5.  (x + 3)(x + 4)',
          '6.  (x - 3)(x + 3)',
          '7.  2x(x + 4)',
          '8.  (x - 7)(x + 2)',
          '9.  The number is 13.',
          '10. Width = 5 cm, length = 8 cm.',
        ],
      },
    ],
  },
  {
    title: 'Grade 11 Quadratic Equations — Class Test',
    description: 'A 40-mark class test covering solving, the discriminant and graph sketching. 60 minutes.',
    documentKind: 'test',
    pages: [
      {
        heading: 'Grade 11 Mathematics · Quadratics Test (40 marks)',
        lines: [
          'Time: 60 minutes.  Calculators allowed.  Show all working.',
          '',
          'Question 1  (10 marks)',
          'Solve for x:',
          '  a)  x^2 - 5x + 6 = 0',
          '  b)  2x^2 + 3x - 2 = 0',
          '',
          'Question 2  (12 marks)',
          'For the equation x^2 - 4x + k = 0:',
          '  a)  Determine the value(s) of k for equal roots.',
          '  b)  Determine the value(s) of k for non-real roots.',
          '',
          'Question 3  (18 marks)',
          'Given f(x) = x^2 - 2x - 3:',
          '  a)  Find the x- and y-intercepts.',
          '  b)  Find the coordinates of the turning point.',
          '  c)  Sketch the graph, clearly showing all intercepts.',
        ],
      },
    ],
  },
  {
    title: "Grade 10 Physics — Newton's Laws Study Notes",
    description: "Summary notes on Newton's three laws of motion with worked examples and key definitions.",
    documentKind: 'notes',
    pages: [
      {
        heading: "Physical Sciences · Newton's Laws of Motion",
        lines: [
          "Newton's First Law (Inertia)",
          'An object continues in a state of rest or uniform motion',
          'unless acted on by a net (resultant) force.',
          '',
          "Newton's Second Law",
          'The net force on an object equals the rate of change of',
          'its momentum.  In CAPS form:  F(net) = m * a',
          '  • F(net) measured in newtons (N)',
          '  • m measured in kilograms (kg)',
          '  • a measured in metres per second squared (m/s^2)',
          '',
          "Newton's Third Law",
          'For every action force there is an equal and opposite',
          'reaction force, acting on a different object.',
          '',
          'Worked example',
          'A 5 kg box is pushed with a net force of 20 N.',
          'a = F(net) / m = 20 / 5 = 4 m/s^2',
        ],
      },
    ],
  },
];

/** Render one MockDoc to a PDF buffer with pdfkit. */
function renderPdf(doc: MockDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];
    pdf.on('data', (c) => chunks.push(c as Buffer));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    doc.pages.forEach((page, idx) => {
      if (idx > 0) pdf.addPage();
      // Brand strip
      pdf.fillColor('#0d9488').fontSize(10).font('Helvetica-Bold')
        .text('EduSpark · SA CAPS Practice Material', { align: 'right' });
      pdf.moveDown(1.2);
      pdf.fillColor('#0f172a').fontSize(18).font('Helvetica-Bold')
        .text(page.heading);
      pdf.moveDown(0.4);
      pdf.strokeColor('#14b8a6').lineWidth(2)
        .moveTo(pdf.x, pdf.y).lineTo(pdf.page.width - 56, pdf.y).stroke();
      pdf.moveDown(0.8);
      pdf.fillColor('#1e293b').fontSize(12).font('Helvetica');
      page.lines.forEach((line) => {
        pdf.text(line || ' ');
      });
      // Footer
      pdf.fontSize(8).fillColor('#94a3b8')
        .text(`${doc.title}  ·  page ${idx + 1} of ${doc.pages.length}`,
          56, pdf.page.height - 48, { align: 'center', width: pdf.page.width - 112 });
    });

    pdf.end();
  });
}

async function main() {
  console.log('📄 EduSpark · mock-PDF seed starting…\n');

  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log(`✓ Created uploads dir: ${UPLOAD_DIR}`);
  }

  // Any admin will do as the "uploaded by" actor; fall back to first user.
  const uploader = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    ?? await prisma.user.findFirst();
  if (!uploader) {
    console.log('❌ No users in the database — run `npm run db:seed` first.');
    return;
  }
  console.log(`✓ Uploader: ${uploader.name} (${uploader.pin})\n`);

  let created = 0;
  let skipped = 0;

  for (const mock of MOCKS) {
    const existing = await prisma.pdfDocument.findFirst({ where: { title: mock.title } });
    if (existing) {
      const onDisk = fs.existsSync(path.join(UPLOAD_DIR, existing.filePath));
      if (onDisk) {
        console.log(`• Skipped (already seeded): ${mock.title}`);
        skipped++;
        continue;
      }
      // Row exists but file is missing — regenerate the file in place.
      console.log(`↻ Re-generating missing file for: ${mock.title}`);
    }

    const buffer = await renderPdf(mock);
    const safe = mock.title.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `mock-${Date.now()}-${safe}.pdf`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, buffer);

    const extractedText = mock.pages
      .map((p) => `${p.heading}\n${p.lines.join('\n')}`)
      .join('\n\n')
      .slice(0, 50000);

    if (existing) {
      await prisma.pdfDocument.update({
        where: { id: existing.id },
        data: {
          filePath: fileName,
          fileSize: buffer.length,
          pageCount: mock.pages.length,
          extractedText,
        },
      });
    } else {
      await prisma.pdfDocument.create({
        data: {
          title: mock.title,
          description: mock.description,
          filePath: fileName,
          fileSize: buffer.length,
          pageCount: mock.pages.length,
          extractedText,
          documentKind: mock.documentKind,
          uploadedById: uploader.id,
        },
      });
    }
    console.log(`✓ Seeded: ${mock.title}  (${mock.pages.length} page(s), ${(buffer.length / 1024).toFixed(1)} KB)`);
    created++;
  }

  console.log(`\n✅ Mock-PDF seed complete — ${created} created, ${skipped} skipped.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
