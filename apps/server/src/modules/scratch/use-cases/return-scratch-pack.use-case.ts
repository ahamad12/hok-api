import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { type ScratchPackResult, toScratchPackResult } from "../mappers/scratch-pack.mapper";
import { ScratchPackRepository } from "../repositories/scratch-pack.repository";

export interface ReturnScratchPackInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  packId: string;
}

@Injectable()
export class ReturnScratchPackUseCase {
  constructor(private readonly scratchPackRepository: ScratchPackRepository) {}

  async execute(input: ReturnScratchPackInput): Promise<ScratchPackResult> {
    const pack = await this.scratchPackRepository.findById(input.packId);
    if (!pack) throw new NotFoundError("ScratchPack", input.packId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== pack.shopId) {
      throw new AuthorizationError("Access denied for this pack");
    }

    // STATE MACHINE: ACTIVE -> RETURNED is one-way and only reachable
    // from ACTIVE — a FINISHED pack was fully sold, not returnable; an
    // already-RETURNED pack can't be returned again.
    if (pack.status !== "ACTIVE") {
      throw new BusinessRuleError(`Cannot return a pack with status ${pack.status}`);
    }

    const updated = await this.scratchPackRepository.updateStatus(pack.id, {
      status: "RETURNED",
      returnedAt: new Date(),
    });
    return toScratchPackResult(updated);
  }
}
