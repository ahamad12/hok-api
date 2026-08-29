-- Drop existing plain uniques (allow NULLs bypass)
DROP INDEX IF EXISTS "tickets_createdById_creationClientId_key";
DROP INDEX IF EXISTS "ticket_messages_ticket_id_client_message_id_key";

-- Hard idempotency guards — partial uniques where key IS NOT NULL
-- (Prisma @@unique can't express WHERE; see 20260806120000_scratch_scan_active_shift_unique)
CREATE UNIQUE INDEX "tickets_created_by_id_creation_client_id_key"
  ON "tickets"("created_by_id", "creation_client_id")
  WHERE "creation_client_id" IS NOT NULL;

CREATE UNIQUE INDEX "ticket_messages_ticket_id_client_message_id_key"
  ON "ticket_messages"("ticket_id", "client_message_id")
  WHERE "client_message_id" IS NOT NULL;
