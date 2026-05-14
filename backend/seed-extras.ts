import 'dotenv/config';
import prisma from './src/db/client';
import { generateQuestion } from './src/utils/questionGenerators';

/**
 * Demo seed (idempotent) — populates a realistic class so the dashboards
 * have something interesting to show after a fresh deploy:
 *
 *   • 2 Content Packs (Algebra Foundations · Quadratic Practice)
 *   • Both shared with the first tutor
 *   • All Gr 10 + Gr 11 students unlocked
 *   • A spread of historical quiz results across students
 *   • A few calendar notes for next week
 *   • A few notifications
 *
 * Re-runnable safely: every step checks-then-upserts.
 *
 *   npx tsx seed-extras.ts
 */

const DIFF_MAP: Record<string, 'EASY' | 'MEDIUM' | 'HARD'> = {
  Easy: 'EASY', Medium: 'MEDIUM', Hard: 'HARD',
};

async function ensureQuestionsForTopic(topic: string, subject: 'MATHEMATICS' | 'PHYSICAL_SCIENCES', grade: number, count: number, createdById: string) {
  const existing = await prisma.question.findMany({ where: { subject, grade, topic } });
  if (existing.length >= count) return existing.slice(0, count);

  const need = count - existing.length;
  const generated = [];
  for (let i = 0; i < need; i++) {
    const d = generateQuestion(topic, subject.toLowerCase(), grade);
    const q = await prisma.question.create({
      data: {
        subject, grade, topic,
        difficulty: DIFF_MAP[d.diff] || 'MEDIUM',
        question: d.q, options: d.opts, answer: d.ans, solution: d.sol,
        visibility: 'ALL', status: 'PUBLISHED', createdById,
      },
    });
    generated.push(q);
  }
  return [...existing, ...generated];
}

async function ensurePack(title: string, args: {
  description: string;
  subject: 'MATHEMATICS' | 'PHYSICAL_SCIENCES';
  grade: number;
  topic: string;
  coverEmoji: string;
  createdById: string;
  questionIds: string[];
}) {
  const existing = await prisma.pack.findFirst({ where: { title } });
  if (existing) {
    return existing;
  }
  return prisma.pack.create({
    data: {
      title, description: args.description,
      subject: args.subject, grade: args.grade, topic: args.topic,
      coverEmoji: args.coverEmoji, createdById: args.createdById,
      questions: { create: args.questionIds.map((qId, order) => ({ questionId: qId, order })) },
    },
  });
}

async function ensureShare(packId: string, tutorId: string, sharedById: string, note?: string) {
  await prisma.packShare.upsert({
    where: { packId_tutorId: { packId, tutorId } },
    update: {},
    create: { packId, tutorId, sharedById, note: note ?? null },
  });
}

async function ensureUnlock(studentId: string, packId: string, unlockedById: string) {
  await prisma.studentUnlock.upsert({
    where: { studentId_packId: { studentId, packId } },
    update: {},
    create: { studentId, packId, unlockedById },
  });
}

function pickRandomFrom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

async function main() {
  console.log('🌱 EduSpark · demo seed starting…\n');

  const admin = await prisma.user.findFirst({ where: { pin: 'ADM-ALIS' } });
  if (!admin) { console.log('❌ ADM-ALIS missing — run `npm run db:seed` first.'); return; }

  // ─── Ensure tutors + students are linked ────────────────────────
  const tutors = await prisma.user.findMany({ where: { role: 'TUTOR', active: true } });
  if (!tutors.length) { console.log('❌ No tutors — create at least one via the normal flow first.'); return; }
  const primaryTutor = tutors[0];
  console.log(`✓ Primary tutor: ${primaryTutor.name} (${primaryTutor.pin})`);

  const students = await prisma.user.findMany({
    where: { role: 'STUDENT', active: true, grade: { in: [10, 11] } },
    orderBy: { name: 'asc' },
  });
  if (students.length < 2) { console.log('❌ Need at least 2 active Gr10/11 students.'); return; }

  // Pair half the students with primaryTutor (skip if already paired)
  const unpaired = students.filter((s) => !s.teacherId);
  for (const s of unpaired.slice(0, Math.min(4, unpaired.length))) {
    await prisma.user.update({ where: { id: s.id }, data: { teacherId: primaryTutor.id } });
    console.log(`✓ Paired ${s.name} → ${primaryTutor.name}`);
  }

  // ─── Pack 1: Algebra Foundations (Gr10) ──────────────────────────
  const alg10 = await ensureQuestionsForTopic('Algebra', 'MATHEMATICS', 10, 5, admin.id);
  const pack1 = await ensurePack('Algebra Foundations · Demo', {
    description: 'Linear equations, factorisation, and basic algebraic manipulation.',
    subject: 'MATHEMATICS', grade: 10, topic: 'Algebra', coverEmoji: '🧮',
    createdById: admin.id, questionIds: alg10.map((q) => q.id),
  });
  await ensureShare(pack1.id, primaryTutor.id, admin.id, 'Start of term warm-ups.');
  console.log(`✓ Pack: ${pack1.title} (${alg10.length} Q) — shared with ${primaryTutor.name}`);

  // ─── Pack 2: Quadratic Practice (Gr11) ───────────────────────────
  const quad11 = await ensureQuestionsForTopic('Quadratic Equations', 'MATHEMATICS', 11, 5, admin.id);
  const pack2 = await ensurePack('Quadratic Practice · Gr11', {
    description: 'Solve, factorise and graph quadratic equations.',
    subject: 'MATHEMATICS', grade: 11, topic: 'Quadratic Equations', coverEmoji: '📈',
    createdById: admin.id, questionIds: quad11.map((q) => q.id),
  });
  await ensureShare(pack2.id, primaryTutor.id, admin.id, 'For the exam-prep stream.');
  console.log(`✓ Pack: ${pack2.title} (${quad11.length} Q) — shared with ${primaryTutor.name}`);

  // ─── Pack 3: Newton's Laws (Gr10 Physics) ────────────────────────
  const nl10 = await ensureQuestionsForTopic("Newton's Laws", 'PHYSICAL_SCIENCES', 10, 5, admin.id);
  const pack3 = await ensurePack("Newton's Laws · Quick Drill", {
    description: 'Force, mass and acceleration — F = ma in many flavours.',
    subject: 'PHYSICAL_SCIENCES', grade: 10, topic: "Newton's Laws", coverEmoji: '⚙️',
    createdById: admin.id, questionIds: nl10.map((q) => q.id),
  });
  await ensureShare(pack3.id, primaryTutor.id, admin.id);
  console.log(`✓ Pack: ${pack3.title} (${nl10.length} Q) — shared with ${primaryTutor.name}`);

  // ─── Unlock packs for the tutor's students ──────────────────────
  const tutorsClass = await prisma.user.findMany({ where: { role: 'STUDENT', teacherId: primaryTutor.id, active: true } });
  for (const s of tutorsClass) {
    const packsForGrade = [pack1, pack3];
    if (s.grade === 11) packsForGrade.push(pack2);
    for (const p of packsForGrade) {
      if (p.grade === s.grade) {
        await ensureUnlock(s.id, p.id, primaryTutor.id);
      }
    }
  }
  console.log(`✓ Unlocked packs for ${tutorsClass.length} students.`);

  // ─── Synthesize some practice + assignment results so dashboards live ───
  const allPackQs = [...alg10, ...quad11, ...nl10];
  let resultsCreated = 0;
  for (const s of tutorsClass) {
    // Skip if this student already has practice results — keep idempotent
    const existing = await prisma.quizResult.count({ where: { userId: s.id } });
    if (existing >= 3) continue;

    // 3 practice sessions, varied score
    for (let i = 0; i < 3; i++) {
      const qs = pickRandomFrom(allPackQs.filter((q) => q.grade === s.grade), 3);
      if (!qs.length) continue;
      const correctCount = Math.floor(Math.random() * (qs.length + 1)); // 0..n
      const score = Math.round((correctCount / qs.length) * 100);
      const completedAt = new Date(Date.now() - i * 86_400_000 - Math.random() * 3_600_000); // last few days
      await prisma.quizResult.create({
        data: {
          score, correct: correctCount, total: qs.length, timeTaken: 60 * qs.length, xpEarned: Math.round(score / 2),
          resultType: 'PRACTICE',
          practiceTopic: qs[0].topic, practiceSubject: qs[0].subject,
          userId: s.id, completedAt,
          details: {
            create: qs.map((q, idx) => ({
              questionText: q.question,
              selectedAnswer: idx < correctCount ? q.answer : (q.options.find((o) => o !== q.answer) || ''),
              correctAnswer: q.answer,
              isCorrect: idx < correctCount,
              solution: q.solution,
              difficulty: q.difficulty,
              questionId: q.id,
            })),
          },
        },
      });
      resultsCreated++;
    }
    // Bump XP to reflect the synthetic activity
    await prisma.user.update({
      where: { id: s.id },
      data: { xp: { increment: 30 + Math.floor(Math.random() * 80) } },
    });
  }
  console.log(`✓ Created ${resultsCreated} demo practice result(s).`);

  // ─── Calendar notes (tutor → class, admin broadcast) ────────────
  const today = new Date();
  const inDays = (n: number) => {
    const d = new Date(today); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const notes = [
    {
      key: `tutor-session-${primaryTutor.id}`,
      data: {
        date: inDays(3), title: 'Quadratics session', content: 'Bring exercise book + calculator',
        color: 'session', kind: 'session', tutorId: primaryTutor.id, sharedWithAdmin: false,
        createdById: primaryTutor.id,
      },
    },
    {
      key: 'admin-broadcast-1',
      data: {
        date: inDays(7), title: 'School-wide exam revision week', content: 'Extra hours on Tuesday + Thursday',
        color: 'note', kind: 'broadcast', tutorId: null, sharedWithAdmin: false,
        createdById: admin.id,
      },
    },
  ];
  for (const n of notes) {
    const exists = await prisma.calendarNote.findFirst({ where: { title: n.data.title, date: n.data.date } });
    if (!exists) {
      await prisma.calendarNote.create({ data: n.data });
      console.log(`✓ Calendar: ${n.data.title} (${n.data.date})`);
    }
  }

  // ─── A welcome notification for each student ────────────────────
  for (const s of tutorsClass) {
    const recent = await prisma.notification.findFirst({
      where: { userId: s.id, type: 'pack_unlocked' },
    });
    if (recent) continue;
    await prisma.notification.create({
      data: {
        userId: s.id, type: 'pack_unlocked',
        title: '🔓 New practice unlocked',
        body: 'Your tutor has unlocked Algebra Foundations · Demo for you.',
        link: '/app/practice',
      },
    });
  }
  console.log(`✓ Notification dispatched to ${tutorsClass.length} students.`);

  console.log('\n✅ Demo seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
