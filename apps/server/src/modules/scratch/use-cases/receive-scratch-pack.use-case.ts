import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { type ScratchPackResult, toScratchPackResult } from "../mappers/scratch-pack.mapper";
import { ScratchGameRepository } from "../repositories/scratch-game.repository";
import { ScratchPackRepository } from "../repositories/scratch-pack.repository";

export interface ReceiveScratchPackInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  shopId: string;
  gameId: string;
  serialStart: string;
  location: "DISPLAY" | "BACKSTOCK";
}

@Injectable()
export class ReceiveScratchPackUseCase {
  constructor(
    private readonly scratchPackRepository: ScratchPackRepository,
    private readonly scratchGameRepository: ScratchGameRepository,
    private readonly shopRepository: ShopRepository,
  ) {}

  async execute(input: ReceiveScratchPackInput): Promise<ScratchPackResult> {
    if (!canAccessShop(requesterScope(input), input.shopId)) {
      throw new AuthorizationError("You can only receive packs for your own shop");
    }

    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    const game = await this.scratchGameRepository.findById(input.gameId);
    if (!game || game.shopId !== input.shopId || !game.isActive) {
      throw new NotFoundError("ScratchGame", input.gameId);
    }

    // Duplicate (gameId + serialStart) receives are rejected by the DB
    // unique constraint and translated to a 409 ConflictError in the
    // repository, so a concurrent double-receive cannot fall through to
    // a 500.
    const pack = await this.scratchPackRepository.create({
      gameId: input.gameId,
      shopId: input.shopId,
      serialStart: input.serialStart,
      status: "ACTIVE",
      location: input.location,
      receivedById: input.requesterId,
      receivedAt: new Date(),
    });

    return toScratchPackResult(pack);
  }
}
