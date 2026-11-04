-- Tenant ownership: every MANAGER/STAFF belongs to exactly one OWNER's
-- business (users.owner_id). OWNERs are their own tenant (owner_id NULL).

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "owner_id" TEXT;

-- CreateIndex
CREATE INDEX "users_owner_id_idx" ON "users"("owner_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- An OWNER never belongs to another tenant.
ALTER TABLE "users" ADD CONSTRAINT "users_owner_has_no_owner_chk"
  CHECK ("role" <> 'OWNER' OR "owner_id" IS NULL);

-- Backfill 1: staff assigned to a shop belong to that shop's owner.
UPDATE "users" u
SET "owner_id" = s."owner_id"
FROM "shops" s
WHERE u."shop_id" = s."id" AND u."role" <> 'OWNER' AND u."owner_id" IS NULL;

-- Backfill 2: before multi-tenancy there was effectively one business. If
-- exactly one OWNER exists, the remaining MANAGER/STAFF belong to them.
UPDATE "users"
SET "owner_id" = (SELECT "id" FROM "users" WHERE "role" = 'OWNER')
WHERE "role" <> 'OWNER' AND "owner_id" IS NULL
  AND (SELECT count(*) FROM "users" WHERE "role" = 'OWNER') = 1;

-- Anyone still unassigned fails closed: they can sign in but can reach no
-- shop until an owner is set by hand. List them with:
--   SELECT id, email, role FROM users WHERE role <> 'OWNER' AND owner_id IS NULL;
DO $$
DECLARE orphaned integer;
BEGIN
  SELECT count(*) INTO orphaned FROM "users" WHERE "role" <> 'OWNER' AND "owner_id" IS NULL;
  IF orphaned > 0 THEN
    RAISE NOTICE '% MANAGER/STAFF user(s) have no tenant owner; assign users.owner_id manually', orphaned;
  END IF;
END $$;
