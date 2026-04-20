import 'dotenv/config';
import prisma from './client';

async function main() {
  console.log('🌱 Seeding EduSpark database...');

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { pin: 'ADMIN' },
    update: {},
    create: { name: 'Ms. Ndlovu', role: 'ADMIN', pin: null },
  });

  // Create sample students
  const students = await Promise.all([
    prisma.user.upsert({
      where: { pin: 'SPK-AM1D' },
      update: {},
      create: { name: 'Amahle Dlamini', role: 'STUDENT', pin: 'SPK-AM1D', grade: 10, xp: 720 },
    }),
    prisma.user.upsert({
      where: { pin: 'SPK-SN2K' },
      update: {},
      create: { name: 'Sipho Nkosi', role: 'STUDENT', pin: 'SPK-SN2K', grade: 10, xp: 420 },
    }),
    prisma.user.upsert({
      where: { pin: 'SPK-ZM3K' },
      update: {},
      create: { name: 'Zanele Mokoena', role: 'STUDENT', pin: 'SPK-ZM3K', grade: 10, xp: 1350 },
    }),
    prisma.user.upsert({
      where: { pin: 'SPK-LM4M' },
      update: {},
      create: { name: 'Lebo Mokwena', role: 'STUDENT', pin: 'SPK-LM4M', grade: 11, xp: 280 },
    }),
  ]);

  // Create sample questions
  const questions = await Promise.all([
    prisma.question.create({
      data: {
        subject: 'MATHEMATICS',
        grade: 10,
        topic: 'Algebra',
        difficulty: 'EASY',
        question: 'Solve: 3x + 6 = 21',
        options: ['x=5', 'x=9', 'x=3', 'x=7'],
        answer: 'x=5',
        solution: '3x=15, x=5',
        visibility: 'ALL',
        createdById: admin.id,
      },
    }),
    prisma.question.create({
      data: {
        subject: 'MATHEMATICS',
        grade: 10,
        topic: 'Algebra',
        difficulty: 'MEDIUM',
        question: 'Factorise: x²−5x+6',
        options: ['(x−2)(x−3)', '(x+2)(x+3)', '(x−1)(x−6)', 'x(x−5)'],
        answer: '(x−2)(x−3)',
        solution: 'Numbers: −2×−3=6, −2+(−3)=−5 → (x−2)(x−3)',
        visibility: 'ALL',
        createdById: admin.id,
      },
    }),
    prisma.question.create({
      data: {
        subject: 'MATHEMATICS',
        grade: 11,
        topic: 'Quadratic Equations',
        difficulty: 'HARD',
        question: 'Solve 2x²−7x+3=0',
        options: ['x=3 or x=0.5', 'x=2 or x=1.5', 'x=−3 or x=−0.5', 'x=7'],
        answer: 'x=3 or x=0.5',
        solution: 'Δ=49−24=25, x=(7±5)/4 → x=3 or x=0.5',
        visibility: 'ALL',
        createdById: admin.id,
      },
    }),
    prisma.question.create({
      data: {
        subject: 'PHYSICAL_SCIENCES',
        grade: 10,
        topic: "Newton's Laws",
        difficulty: 'EASY',
        question: '10kg, a=3m/s². Net force?',
        options: ['30N', '13N', '7N', '300N'],
        answer: '30N',
        solution: 'F=ma=10×3=30N',
        visibility: 'ALL',
        createdById: admin.id,
      },
    }),
    prisma.question.create({
      data: {
        subject: 'PHYSICAL_SCIENCES',
        grade: 10,
        topic: 'Energy & Power',
        difficulty: 'EASY',
        question: 'KE of 5kg at 4m/s?',
        options: ['40J', '80J', '20J', '10J'],
        answer: '40J',
        solution: 'KE=½mv²=½×5×16=40J',
        visibility: 'ALL',
        createdById: admin.id,
      },
    }),
  ]);

  // Create sample assignments
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 3);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const a1 = await prisma.assignment.create({
    data: {
      title: 'Algebra Basics',
      subject: 'MATHEMATICS',
      grade: 10,
      topic: 'Algebra',
      dueDate: tomorrow,
      assignTo: 'all',
      createdById: admin.id,
      questions: {
        create: [
          { questionId: questions[0].id, order: 0 },
          { questionId: questions[1].id, order: 1 },
        ],
      },
      documents: {
        create: [{
          title: 'Algebra Study Notes',
          content: 'Key Formulas:\n\n• ax + b = c → x = (c−b)/a\n\n• Factorisation: x² + (a+b)x + ab = (x+a)(x+b)\n\nTip: Always substitute your answer back to check!',
          documentType: 'text',
        }],
      },
    },
  });

  await prisma.assignment.create({
    data: {
      title: "Newton's Laws Test",
      subject: 'PHYSICAL_SCIENCES',
      grade: 10,
      topic: "Newton's Laws",
      dueDate: nextWeek,
      assignTo: 'all',
      createdById: admin.id,
      questions: { create: [{ questionId: questions[3].id, order: 0 }] },
      documents: {
        create: [{
          title: "Newton's Laws Summary",
          content: "Newton's 3 Laws:\n\n1st Law (Inertia): Objects stay at rest or moving unless a net force acts.\n\n2nd Law: F = ma\n\n3rd Law: Every action has an equal & opposite reaction.",
          documentType: 'text',
        }],
      },
    },
  });

  // Add calendar notes
  const d1 = new Date();
  d1.setDate(d1.getDate() + 2);
  const d2 = new Date();
  d2.setDate(d2.getDate() + 8);

  await prisma.calendarNote.createMany({
    data: [
      { date: d1.toISOString().split('T')[0], title: 'Parent Meeting', content: '14:00 in the hall', color: 'note', createdById: admin.id },
      { date: d2.toISOString().split('T')[0], title: 'Term Test Reminder', content: 'Prepare students', color: 'up', createdById: admin.id },
    ],
  });

  // Add some results for Amahle
  await prisma.quizResult.create({
    data: {
      score: 80,
      correct: 1,
      total: 2,
      timeTaken: 180,
      xpEarned: 52,
      userId: students[0].id,
      assignmentId: a1.id,
      details: {
        create: [
          { questionText: 'Solve: 3x + 6 = 21', selectedAnswer: 'x=5', correctAnswer: 'x=5', isCorrect: true, difficulty: 'EASY' },
          { questionText: 'Factorise: x²−5x+6', selectedAnswer: '(x+2)(x+3)', correctAnswer: '(x−2)(x−3)', isCorrect: false, difficulty: 'MEDIUM' },
        ],
      },
    },
  });

  await prisma.user.update({ where: { id: students[0].id }, data: { xp: { increment: 52 } } });

  console.log('✅ Seed complete!');
  console.log(`   Admin: Ms. Ndlovu (session-based)`);
  console.log(`   Students: ${students.map((s) => `${s.name} (${s.pin})`).join(', ')}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
