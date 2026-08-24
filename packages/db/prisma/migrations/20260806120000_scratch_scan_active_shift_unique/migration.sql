-- CreateIndex
-- At most one ACTIVE (non-voided) scan per pack/date/shift. Partial
-- (WHERE voided_at IS NULL) so a voided scan frees its slot for a
-- corrected re-scan. Partial indexes can't be expressed in
-- schema.prisma (@@unique/@@index have no WHERE clause).
CREATE UNIQUE INDEX "scratch_scan_events_pack_shift_active_key"
  ON "scratch_scan_events"("pack_id", "scan_date", "shift_period")
  WHERE "voided_at" IS NULL;
