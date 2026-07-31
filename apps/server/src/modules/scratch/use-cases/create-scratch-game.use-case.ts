import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { type ScratchGameResult, toScratchGameResult } from "../mappers/scratch-game.mapper";
import { ScratchGameRepository } from "../repositories/scratch-game.repository";

export interface CreateScratchGameInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  shopId: string;
  gameNumber?: string;
  name: string;
  priceCents: number;
  ticketsPerPack: number;
}

@Injectable()
export class CreateScratchGameUseCase {
  constructor(
    private readonly scratchGameRepository: ScratchGameRepository,
    private readonly shopRepository: ShopRepository,
  ) {}

  async execute(input: CreateScratchGameInput): Promise<ScratchGameResult> {
    // Route restricts this to OWNER/MANAGER (@Roles) — STAFF is still
    // shop-scoped here as defense in depth.
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
      throw new AuthorizationError("You can only create games for your own shop");
    }

    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    const game = await this.scratchGameRepository.create({
      shopId: input.shopId,
      gameNumber: input.gameNumber ?? null,
      name: input.name,
      priceCents: input.priceCents,
      ticketsPerPack: input.ticketsPerPack,
    });

    return toScratchGameResult(game);
  }
}
