import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

if (typeof BigInt === "function" && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
