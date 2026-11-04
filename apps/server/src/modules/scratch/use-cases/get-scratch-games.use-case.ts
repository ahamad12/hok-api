import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError } from "../../../common/errors";
import { type ScratchGameResult, toScratchGameResult } from "../mappers/scratch-game.mapper";
import { ScratchGameRepository } from "../repositories/scratch-game.repository";

export interface GetScratchGamesInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  shopId: string;
  isActive?: boolean;
}

@Injectable()
export class GetScratchGamesUseCase {
  constructor(private readonly scratchGameRepository: ScratchGameRepository) {}

  async execute(input: GetScratchGamesInput): Promise<ScratchGameResult[]> {
    if (!canAccessShop(requesterScope(input), input.shopId)) {
      throw new AuthorizationError("Access denied for this shop");
    }
    const games = await this.scratchGameRepository.findAll({
      shopId: input.shopId,
      isActive: input.isActive,
    });
    return games.map(toScratchGameResult);
  }
}
