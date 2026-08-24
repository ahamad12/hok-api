-- CreateIndex
-- One scratch game name per shop, mirroring Category (@@unique([shopId, name])) and Supplier.
-- Duplicate names inside a shop are a data-entry mistake; the P2002 from this
-- index is translated to a ConflictError by ScratchGameRepository.
CREATE UNIQUE INDEX "scratch_games_shop_id_name_key" ON "scratch_games"("shop_id", "name");
