import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { type ScratchGameResult, toScratchGameResult } from "../mappers/scratch-game.mapper";
import { ScratchGameRepository } from "../repositories/scratch-game.repository";

export interface GetScratchGameByIdInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  gameId: string;
}

@Injectable()
export class GetScratchGameByIdUseCase {
  constructor(private readonly scratchGameRepository: ScratchGameRepository) {}

  async execute(input: GetScratchGameByIdInput): Promise<ScratchGameResult> {
    const game = await this.scratchGameRepository.findById(input.gameId);
    if (!game) throw new NotFoundError("ScratchGame", input.gameId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== game.shopId) {
      throw new AuthorizationError("Access denied for this game");
    }

    return toScratchGameResult(game);
  }
}
