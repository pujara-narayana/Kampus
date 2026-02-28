const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({ where: { email: "smohanty13@huskers.unl.edu" }});
  if (!user) { console.log("User not found"); return; }
  console.log("User tokens:", user.googleToken ? "Exists" : "None");
  const sched = await prisma.classSchedule.findMany({ where: { userId: user.id } });
  console.log("Schedule count:", sched.length);
  const assignments = await prisma.assignment.findMany({ where: { userId: user.id }});
  console.log("Assignments count:", assignments.length);
}
main().catch(console.error).finally(() => prisma.$disconnect());
