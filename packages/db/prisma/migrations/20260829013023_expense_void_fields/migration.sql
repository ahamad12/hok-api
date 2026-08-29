-- AlterTable
ALTER TABLE "expenses" ADD COLUMN "voided_at" TIMESTAMP(3);
ALTER TABLE "expenses" ADD COLUMN "voided_by_id" TEXT;
ALTER TABLE "expenses" ADD COLUMN "void_reason" TEXT;

-- CreateIndex
CREATE INDEX "expenses_shop_id_voided_at_idx" ON "expenses"("shop_id", "voided_at");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
