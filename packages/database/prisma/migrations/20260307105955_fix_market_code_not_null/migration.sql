/*
  Warnings:

  - Made the column `marketCode` on table `CategoryPlatformMapping` required. This step will fail if there are existing NULL values in that column.
  - Made the column `marketCode` on table `PlatformCategory` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "PlatformCategory_platform_marketCode_idx";

-- AlterTable
ALTER TABLE "CategoryPlatformMapping" ALTER COLUMN "marketCode" SET NOT NULL,
ALTER COLUMN "marketCode" SET DEFAULT 'GLOBAL';

-- AlterTable
ALTER TABLE "PlatformCategory" ALTER COLUMN "marketCode" SET NOT NULL,
ALTER COLUMN "marketCode" SET DEFAULT 'GLOBAL';
