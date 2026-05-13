import 'dotenv/config';
import prisma from './src/db/client';

async function main() {
  console.log('🌱 Seeding Phase 1-5 demo data...');

  const admin = await prisma.user.findFirst({ where: { pin: 'ADM-ALIS' } });
  if (!admin) { console.log('No admin ADM-ALIS — run main seed first.'); return; }

  // Find existing tutor + student
  const tutor = await prisma.user.findFirst({ where: { role: 'TUTOR' } });
  const student = await prisma.user.findFirst({ where: { role: 'STUDENT', grade: 10 } });

  // Get some questions
  const qs = await prisma.question.findMany({ where: { subject: 'MATHEMATICS', grade: 10 }, take: 3 });
  if (qs.length === 0) { console.log('No questions yet.'); return; }

  // Check if demo pack already exists
  const existing = await prisma.pack.findFirst({ where: { title: 'Algebra Foundations · Demo' } });
  let pack = existing;
  if (!pack) {
    pack = await prisma.pack.create({
      data: {
        title: 'Algebra Foundations · Demo',
        description: 'Start with linear equations and simple factorisation.',
        subject: 'MATHEMATICS', grade: 10, topic: 'Algebra',
        coverEmoji: '🧮',
        createdById: admin.id,
        questions: { create: qs.map((q, i) => ({ questionId: q.id, order: i })) },
      },
    });
    console.log('✓ Created demo pack:', pack.title);
  } else {
    console.log('✓ Demo pack already exists.');
  }

  // Share with first tutor
  if (tutor) {
    await prisma.packShare.upsert({
      where: { packId_tutorId: { packId: pack.id, tutorId: tutor.id } },
      update: {},
      create: {
        packId: pack.id, tutorId: tutor.id, sharedById: admin.id,
        note: 'Welcome! Try unlocking this for one of your students.',
      },
    });
    console.log(`✓ Shared pack with tutor: ${tutor.name}`);

    // Auto-unlock for student linked to that tutor (if any)
    if (student) {
      // If the student isn't linked to this tutor, link them so demo flows
      if (student.teacherId !== tutor.id) {
        await prisma.user.update({ where: { id: student.id }, data: { teacherId: tutor.id } });
        console.log(`✓ Linked student ${student.name} to tutor ${tutor.name}`);
      }
      await prisma.studentUnlock.upsert({
        where: { studentId_packId: { studentId: student.id, packId: pack.id } },
        update: {},
        create: { studentId: student.id, packId: pack.id, unlockedById: tutor.id },
      });
      console.log(`✓ Unlocked pack for student: ${student.name}`);
    }
  }

  console.log('\n✅ Demo seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
