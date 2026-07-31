import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { type ScratchPackResult, toScratchPackResult } from "../mappers/scratch-pack.mapper";
import { ScratchPackRepository } from "../repositories/scratch-pack.repository";

export interface GetScratchPackByIdInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  packId: string;
}

@Injectable()
export class GetScratchPackByIdUseCase {
  constructor(private readonly scratchPackRepository: ScratchPackRepository) {}

  async execute(input: GetScratchPackByIdInput): Promise<ScratchPackResult> {
    const pack = await this.scratchPackRepository.findById(input.packId);
    if (!pack) throw new NotFoundError("ScratchPack", input.packId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== pack.shopId) {
      throw new AuthorizationError("Access denied for this pack");
    }

    return toScratchPackResult(pack);
  }
}
