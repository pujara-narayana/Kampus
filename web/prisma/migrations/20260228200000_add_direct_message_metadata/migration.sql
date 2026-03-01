-- AlterTable
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
