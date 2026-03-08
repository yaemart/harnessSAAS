-- AlterTable
ALTER TABLE "CategoryAlias" ADD COLUMN     "aliasType" TEXT NOT NULL DEFAULT 'synonym';

-- AlterTable
ALTER TABLE "GlobalCategory" ADD COLUMN     "googleTaxonomyId" INTEGER;

-- CreateTable
CREATE TABLE "LegacyCategoryCodeMapping" (
    "id" UUID NOT NULL,
    "oldCode" TEXT NOT NULL,
    "newCode" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "LegacyCategoryCodeMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegacyCategoryCodeMapping_oldCode_key" ON "LegacyCategoryCodeMapping"("oldCode");

-- CreateIndex
CREATE INDEX "LegacyCategoryCodeMapping_oldCode_idx" ON "LegacyCategoryCodeMapping"("oldCode");

-- CreateIndex
CREATE INDEX "LegacyCategoryCodeMapping_newCode_idx" ON "LegacyCategoryCodeMapping"("newCode");

-- CreateIndex
CREATE INDEX "GlobalCategory_googleTaxonomyId_idx" ON "GlobalCategory"("googleTaxonomyId");
