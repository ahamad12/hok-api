-- Delivery check-in: deliveries start PENDING (lines editable, not counted
-- in day totals, not payable) and become RECEIVED when checked in.

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'RECEIVED');

-- AlterTable: existing rows were immutable and already counted, so they
-- backfill as RECEIVED; new rows default to PENDING.
ALTER TABLE "deliveries" ADD COLUMN "status" "DeliveryStatus" NOT NULL DEFAULT 'RECEIVED',
ADD COLUMN     "received_at" TIMESTAMP(3),
ADD COLUMN     "received_by_id" TEXT;

UPDATE "deliveries"
SET "received_at" = "delivered_at", "received_by_id" = "delivered_by_id";

ALTER TABLE "deliveries" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "deliveries_shop_id_status_idx" ON "deliveries"("shop_id", "status");

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
