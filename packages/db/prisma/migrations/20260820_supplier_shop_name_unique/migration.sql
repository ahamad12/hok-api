-- CreateIndex
-- One supplier name per shop, mirroring Category (@@unique([shopId, name])).
-- Duplicate names inside a shop are a data-entry mistake; the P2002 from this
-- index is translated to a ConflictError by SupplierRepository.
CREATE UNIQUE INDEX "suppliers_shop_id_name_key" ON "suppliers"("shop_id", "name");