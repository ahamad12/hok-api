-- DropForeignKey
ALTER TABLE "deliveries" DROP CONSTRAINT "deliveries_supplier_id_fkey";

-- DropForeignKey
ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_category_id_fkey";

-- DropIndex
DROP INDEX "deliveries_is_paid_idx";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "deliveries" DROP COLUMN "is_paid",
DROP COLUMN "payment_mode",
DROP COLUMN "price_cents",
DROP COLUMN "product_name",
DROP COLUMN "quantity",
DROP COLUMN "unit",
ADD COLUMN     "shop_id" TEXT NOT NULL,
ADD COLUMN     "total_amount_cents" INTEGER NOT NULL,
ADD COLUMN     "total_paid_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "void_reason" TEXT,
ADD COLUMN     "voided_at" TIMESTAMP(3),
ADD COLUMN     "voided_by_id" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shop_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "delivery_line_items" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity_ordered" DOUBLE PRECISION NOT NULL,
    "quantity_received" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "line_total_cents" INTEGER NOT NULL,
    "discrepancy_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_payments" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "payment_mode" "PaymentMode" NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id" TEXT NOT NULL,
    "notes" TEXT,
    "voided_at" TIMESTAMP(3),
    "voided_by_id" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_line_items_delivery_id_idx" ON "delivery_line_items"("delivery_id");

-- CreateIndex
CREATE INDEX "delivery_payments_delivery_id_paid_at_idx" ON "delivery_payments"("delivery_id", "paid_at");

-- CreateIndex
CREATE INDEX "categories_is_active_idx" ON "categories"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "categories_shop_id_name_key" ON "categories"("shop_id", "name");

-- CreateIndex
CREATE INDEX "deliveries_shop_id_delivered_at_idx" ON "deliveries"("shop_id", "delivered_at");

-- CreateIndex
CREATE INDEX "suppliers_shop_id_idx" ON "suppliers"("shop_id");

-- CreateIndex
CREATE INDEX "suppliers_shop_id_is_active_idx" ON "suppliers"("shop_id", "is_active");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_line_items" ADD CONSTRAINT "delivery_line_items_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_payments" ADD CONSTRAINT "delivery_payments_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_payments" ADD CONSTRAINT "delivery_payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_payments" ADD CONSTRAINT "delivery_payments_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
