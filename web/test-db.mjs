import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const user = await prisma.user.findFirst({ where: { email: "smohanty13@huskers.unl.edu" } });
    if (!user) { console.log("User not found"); return; }
    console.log("Found User ID:", user.id);
    console.log("User Google Token exists:", !!user.googleToken);
    console.log("Google Token Value:", user.googleToken);

    const sched = await prisma.classSchedule.findMany({ where: { userId: user.id } });
    console.log("Schedule count:", sched.length);
    if (sched.length > 0) {
        console.log("Sample schedule:", sched[0]);
    }

    const assignments = await prisma.assignment.findMany({ where: { userId: user.id } });
    console.log("Assignments count:", assignments.length);

    const courses = await prisma.course.findMany({ where: { userId: user.id } });
    console.log("Courses count:", courses.length);

    const grades = await prisma.grade.findMany({ where: { course: { userId: user.id } } });
    console.log("Grades count:", grades.length);
}
main().catch(console.error).finally(() => prisma.$disconnect());
