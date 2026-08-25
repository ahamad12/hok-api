-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "void_reason" TEXT,
ADD COLUMN     "voided_at" TIMESTAMP(3),
ADD COLUMN     "voided_by_id" TEXT;

-- CreateIndex
CREATE INDEX "tasks_shop_id_voided_at_idx" ON "tasks"("shop_id", "voided_at");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
