-- ProfitReport enterprise close + real expense bucketing
-- CreateEnum
CREATE TYPE "ExpenseBucket" AS ENUM ('PURCHASE','LICENSE','SALARY','UTILITY','RENT','OTHER');

-- AlterTable expense_categories: add bucket
ALTER TABLE "expense_categories" ADD COLUMN "bucket" "ExpenseBucket" NOT NULL DEFAULT 'OTHER';
CREATE INDEX "expense_categories_bucket_idx" ON "expense_categories" ("bucket");

-- One-time backfill by name — REVIEW against real category names before running
UPDATE "expense_categories" SET "bucket" = 'PURCHASE' WHERE "name" ILIKE 'purchase%';
UPDATE "expense_categories" SET "bucket" = 'LICENSE'  WHERE "name" ILIKE 'license%';
UPDATE "expense_categories" SET "bucket" = 'SALARY'   WHERE "name" ILIKE 'salar%';
UPDATE "expense_categories" SET "bucket" = 'UTILITY'  WHERE "name" ILIKE 'utilit%';
UPDATE "expense_categories" SET "bucket" = 'RENT'     WHERE "name" ILIKE 'rent%';

-- AlterTable profit_reports: add void columns
ALTER TABLE "profit_reports" ADD COLUMN "voided_at" TIMESTAMP(3);
ALTER TABLE "profit_reports" ADD COLUMN "voided_by_id" TEXT;
ALTER TABLE "profit_reports" ADD COLUMN "void_reason" TEXT;
ALTER TABLE "profit_reports" ADD CONSTRAINT "profit_reports_voided_by_id_fkey"
  FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique: one live report per period (Prisma can't express WHERE)
CREATE UNIQUE INDEX "profit_reports_shop_period_live_key"
  ON "profit_reports" ("shop_id", "period_start", "period_end")
  WHERE "voided_at" IS NULL;

-- generatedBy Cascade -> Restrict (audit rows must survive user deletion)
ALTER TABLE "profit_reports" DROP CONSTRAINT "profit_reports_generated_by_id_fkey";
ALTER TABLE "profit_reports" ADD CONSTRAINT "profit_reports_generated_by_id_fkey"
  FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable reports: add FK to ProfitReport (disambiguates voided/regenerated PDFs)
ALTER TABLE "reports" ADD COLUMN "profit_report_id" TEXT;
ALTER TABLE "reports" ADD CONSTRAINT "reports_profit_report_id_fkey"
  FOREIGN KEY ("profit_report_id") REFERENCES "profit_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "reports_profit_report_id_idx" ON "reports" ("profit_report_id");
