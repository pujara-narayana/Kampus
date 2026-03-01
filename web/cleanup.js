const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanup() {
    console.log('Cleaning up ghost users...');
    const result = await prisma.user.deleteMany({
        where: {
            displayName: "UNL Student",
            email: null,
            nuid: null,
            provider: "myred",
        }
    });
    console.log(`Deleted ${result.count} ghost users.`);
}

cleanup()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
