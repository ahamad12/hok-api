-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('ISSUE', 'INSTRUCTION', 'ANNOUNCEMENT');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "type" "TicketType" NOT NULL DEFAULT 'ISSUE',
ADD COLUMN "requires_ack" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "assignee_id" TEXT;

-- AlterTable
ALTER TABLE "ticket_messages" ADD COLUMN "client_message_id" TEXT,
ADD COLUMN "sequence" SERIAL NOT NULL;

-- CreateTable
CREATE TABLE "ticket_acknowledgements" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_acknowledgements_ticket_id_user_id_key" ON "ticket_acknowledgements"("ticket_id", "user_id");
CREATE INDEX "ticket_acknowledgements_ticket_id_idx" ON "ticket_acknowledgements"("ticket_id");
CREATE INDEX "ticket_acknowledgements_user_id_idx" ON "ticket_acknowledgements"("user_id");
CREATE UNIQUE INDEX "ticket_messages_ticket_id_client_message_id_key" ON "ticket_messages"("ticket_id", "client_message_id");
CREATE INDEX "ticket_messages_ticket_id_sequence_idx" ON "ticket_messages"("ticket_id", "sequence");
CREATE INDEX "tickets_shop_id_type_status_idx" ON "tickets"("shop_id", "type", "status");
CREATE INDEX "tickets_assignee_id_idx" ON "tickets"("assignee_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ticket_acknowledgements" ADD CONSTRAINT "ticket_acknowledgements_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_acknowledgements" ADD CONSTRAINT "ticket_acknowledgements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
