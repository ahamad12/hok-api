/*
  Warnings:

  - Added the required column `breakdown` to the `daily_summaries` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DailySummaryStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- DropIndex
DROP INDEX "daily_summaries_shop_id_date_key";

-- AlterTable
ALTER TABLE "daily_summaries" ADD COLUMN     "breakdown" JSONB NOT NULL,
ADD COLUMN     "finalized_at" TIMESTAMP(3),
ADD COLUMN     "finalized_by_id" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "status" "DailySummaryStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "variance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "void_reason" TEXT,
ADD COLUMN     "voided_at" TIMESTAMP(3),
ADD COLUMN     "voided_by_id" TEXT;

-- CreateIndex
CREATE INDEX "daily_summaries_shop_id_status_idx" ON "daily_summaries"("shop_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "daily_summaries_shop_id_date_key" ON "daily_summaries"("shop_id", "date") WHERE "voided_at" IS NULL;

-- AddForeignKey
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_finalized_by_id_fkey" FOREIGN KEY ("finalized_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
