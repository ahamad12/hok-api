-- CreateEnum
CREATE TYPE "ScratchPackStatus" AS ENUM ('ACTIVE', 'FINISHED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ScratchPackLocation" AS ENUM ('DISPLAY', 'BACKSTOCK');

-- CreateEnum
CREATE TYPE "LicenseRenewalSource" AS ENUM ('INITIAL', 'RENEWAL');

-- CreateEnum
CREATE TYPE "TillEntryCategory" AS ENUM ('SALES', 'EXPENSE', 'WITHDRAWAL', 'DEPOSIT');

-- DropForeignKey
ALTER TABLE "license_expenses" DROP CONSTRAINT "license_expenses_license_id_fkey";

-- DropForeignKey
ALTER TABLE "scratch_cards" DROP CONSTRAINT "scratch_cards_shop_id_fkey";

-- DropForeignKey
ALTER TABLE "scratch_logs" DROP CONSTRAINT "scratch_logs_card_id_fkey";

-- DropForeignKey
ALTER TABLE "scratch_logs" DROP CONSTRAINT "scratch_logs_logged_by_id_fkey";

-- DropForeignKey
ALTER TABLE "scratch_sales" DROP CONSTRAINT "scratch_sales_card_id_fkey";

-- DropForeignKey
ALTER TABLE "scratch_sales" DROP CONSTRAINT "scratch_sales_shop_id_fkey";

-- DropForeignKey
ALTER TABLE "scratch_sales" DROP CONSTRAINT "scratch_sales_sold_by_id_fkey";

-- DropIndex
DROP INDEX "licenses_expiry_date_idx";

-- DropIndex
DROP INDEX "licenses_shop_id_expiry_date_idx";

-- DropIndex
DROP INDEX "till_entries_shop_id_type_transaction_date_idx";

-- AlterTable
ALTER TABLE "licenses" DROP COLUMN "document_url",
DROP COLUMN "expiry_date",
DROP COLUMN "issue_date",
ADD COLUMN     "current_expiry_date" DATE,
ADD COLUMN     "current_issue_date" DATE,
ADD COLUMN     "current_renewal_id" TEXT;

-- AlterTable
ALTER TABLE "till_entries" DROP COLUMN "type",
ADD COLUMN     "correction_reason" TEXT,
ADD COLUMN     "reverses_entry_id" TEXT,
DROP COLUMN "category",
ADD COLUMN     "category" "TillEntryCategory" NOT NULL;

-- DropTable
DROP TABLE "license_expenses";

-- DropTable
DROP TABLE "scratch_cards";

-- DropTable
DROP TABLE "scratch_logs";

-- DropTable
DROP TABLE "scratch_sales";

-- DropEnum
DROP TYPE "TillEntryType";

-- CreateTable
CREATE TABLE "scratch_games" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "game_number" TEXT,
    "name" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "tickets_per_pack" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scratch_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scratch_packs" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "serial_start" VARCHAR(3) NOT NULL,
    "status" "ScratchPackStatus" NOT NULL DEFAULT 'ACTIVE',
    "location" "ScratchPackLocation" NOT NULL,
    "received_by_id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "returned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scratch_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scratch_scan_events" (
    "id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "sequence_number" SERIAL NOT NULL,
    "scan_date" DATE NOT NULL,
    "shift_period" "PeriodType" NOT NULL,
    "scanned_serial" VARCHAR(3) NOT NULL,
    "tickets_sold_since_previous" INTEGER NOT NULL,
    "tickets_remaining" INTEGER NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "revenue_cents" INTEGER NOT NULL,
    "scanned_by_id" TEXT NOT NULL,
    "voided_at" TIMESTAMP(3),
    "voided_by_id" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scratch_scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_renewals" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "source" "LicenseRenewalSource" NOT NULL,
    "issue_date" DATE NOT NULL,
    "expiry_date" DATE NOT NULL,
    "payment_amount" INTEGER,
    "payment_date" DATE,
    "document_url" TEXT,
    "notes" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "voided_at" TIMESTAMP(3),
    "voided_by_id" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_renewals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scratch_games_shop_id_is_active_idx" ON "scratch_games"("shop_id", "is_active");

-- CreateIndex
CREATE INDEX "scratch_packs_shop_id_status_idx" ON "scratch_packs"("shop_id", "status");

-- CreateIndex
CREATE INDEX "scratch_packs_shop_id_location_idx" ON "scratch_packs"("shop_id", "location");

-- CreateIndex
CREATE INDEX "scratch_packs_game_id_idx" ON "scratch_packs"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "scratch_packs_game_id_serial_start_key" ON "scratch_packs"("game_id", "serial_start");

-- CreateIndex
CREATE INDEX "scratch_scan_events_pack_id_scan_date_shift_period_idx" ON "scratch_scan_events"("pack_id", "scan_date", "shift_period");

-- CreateIndex
CREATE INDEX "scratch_scan_events_pack_id_sequence_number_idx" ON "scratch_scan_events"("pack_id", "sequence_number");

-- CreateIndex
CREATE INDEX "scratch_scan_events_shop_id_scan_date_idx" ON "scratch_scan_events"("shop_id", "scan_date");

-- CreateIndex
CREATE INDEX "scratch_scan_events_shop_id_game_id_scan_date_idx" ON "scratch_scan_events"("shop_id", "game_id", "scan_date");

-- CreateIndex
CREATE INDEX "license_renewals_license_id_created_at_idx" ON "license_renewals"("license_id", "created_at");

-- CreateIndex
CREATE INDEX "license_renewals_license_id_expiry_date_idx" ON "license_renewals"("license_id", "expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_current_renewal_id_key" ON "licenses"("current_renewal_id");

-- CreateIndex
CREATE INDEX "licenses_shop_id_current_expiry_date_idx" ON "licenses"("shop_id", "current_expiry_date");

-- CreateIndex
CREATE INDEX "licenses_current_expiry_date_idx" ON "licenses"("current_expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_shop_id_license_number_key" ON "licenses"("shop_id", "license_number");

-- CreateIndex
CREATE INDEX "till_entries_shop_id_category_transaction_date_idx" ON "till_entries"("shop_id", "category", "transaction_date");

-- CreateIndex
CREATE UNIQUE INDEX "till_entries_reverses_entry_id_key" ON "till_entries"("reverses_entry_id");

-- AddForeignKey
ALTER TABLE "scratch_games" ADD CONSTRAINT "scratch_games_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_packs" ADD CONSTRAINT "scratch_packs_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "scratch_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_packs" ADD CONSTRAINT "scratch_packs_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_packs" ADD CONSTRAINT "scratch_packs_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_scan_events" ADD CONSTRAINT "scratch_scan_events_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "scratch_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_scan_events" ADD CONSTRAINT "scratch_scan_events_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_scan_events" ADD CONSTRAINT "scratch_scan_events_scanned_by_id_fkey" FOREIGN KEY ("scanned_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scratch_scan_events" ADD CONSTRAINT "scratch_scan_events_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_current_renewal_id_fkey" FOREIGN KEY ("current_renewal_id") REFERENCES "license_renewals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_renewals" ADD CONSTRAINT "license_renewals_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_renewals" ADD CONSTRAINT "license_renewals_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_renewals" ADD CONSTRAINT "license_renewals_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "till_entries" ADD CONSTRAINT "till_entries_reverses_entry_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "till_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
