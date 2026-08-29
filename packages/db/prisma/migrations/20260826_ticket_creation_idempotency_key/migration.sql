-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "creation_client_id" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "tickets_createdById_creationClientId_key" ON "tickets"("created_by_id", "creation_client_id");
