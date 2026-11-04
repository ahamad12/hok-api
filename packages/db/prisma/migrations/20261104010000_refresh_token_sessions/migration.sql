-- Refresh-token sessions: families, soft revocation (for reuse detection)
-- and device metadata. Hand-edited from `prisma migrate diff` so existing
-- rows are backfilled before NOT NULL is applied.

-- CreateEnum
CREATE TYPE "RefreshTokenRevokeReason" AS ENUM ('ROTATED', 'LOGOUT', 'LOGOUT_ALL', 'SESSION_REVOKED', 'REUSE_DETECTED', 'PASSWORD_CHANGED');

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "device_name" VARCHAR(100),
ADD COLUMN     "family_id" TEXT,
ADD COLUMN     "ip_address" VARCHAR(64),
ADD COLUMN     "replaced_by_id" TEXT,
ADD COLUMN     "revoke_reason" "RefreshTokenRevokeReason",
ADD COLUMN     "revoked_at" TIMESTAMP(3),
ADD COLUMN     "session_started_at" TIMESTAMP(3),
ADD COLUMN     "user_agent" VARCHAR(512);

-- Backfill: every pre-existing token becomes its own one-token session.
UPDATE "refresh_tokens" SET "family_id" = "id", "session_started_at" = "created_at";

ALTER TABLE "refresh_tokens" ALTER COLUMN "family_id" SET NOT NULL,
ALTER COLUMN "session_started_at" SET NOT NULL,
ALTER COLUMN "session_started_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_id_key" ON "refresh_tokens"("replaced_by_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");
