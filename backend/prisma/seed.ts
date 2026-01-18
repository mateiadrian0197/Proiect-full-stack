import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "prof@test.com";
  const name = "Test Profesor";
  const plainPassword = "test1234";

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const professor = await prisma.user.upsert({
    where: { email },
    update: { name, password: passwordHash, role: "PROFESSOR" },
    create: { email, name, password: passwordHash, role: "PROFESSOR" },
  });

  const course = await prisma.course.create({
    data: {
      title: "Introducere in Web Development",
      description: "Un curs scurt despre HTML, CSS si JavaScript.",
      category: "Web",
      ownerId: professor.id,
      resources: {
        create: [
          { title: "Ghid HTML", url: "https://developer.mozilla.org/en-US/docs/Web/HTML", type: "LINK" },
          { title: "CSS Basics", url: "https://developer.mozilla.org/en-US/docs/Web/CSS", type: "LINK" },
        ],
      },
    },
  });

  await prisma.comment.create({
    data: {
      content: "Cursul e clar si bine structurat.",
      courseId: course.id,
      userId: professor.id,
    },
  });

  console.log(`Seed OK: ${email} / ${plainPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
