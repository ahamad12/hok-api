import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError } from "../../../common/errors";
import { type ScratchPackResult, toScratchPackResult } from "../mappers/scratch-pack.mapper";
import { ScratchPackRepository } from "../repositories/scratch-pack.repository";

export interface GetScratchPacksInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  shopId: string;
  gameId?: string;
  status?: "ACTIVE" | "FINISHED" | "RETURNED";
  location?: "DISPLAY" | "BACKSTOCK";
  limit: number;
  offset: number;
}

export interface GetScratchPacksResult {
  packs: ScratchPackResult[];
  total: number;
}

@Injectable()
export class GetScratchPacksUseCase {
  constructor(private readonly scratchPackRepository: ScratchPackRepository) {}

  async execute(input: GetScratchPacksInput): Promise<GetScratchPacksResult> {
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
      throw new AuthorizationError("Access denied for this shop");
    }

    const { packs, total } = await this.scratchPackRepository.findAll(
      {
        shopId: input.shopId,
        gameId: input.gameId,
        status: input.status,
        location: input.location,
      },
      { limit: input.limit, offset: input.offset },
    );

    return { packs: packs.map(toScratchPackResult), total };
  }
}
