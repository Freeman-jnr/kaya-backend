-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "completed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
