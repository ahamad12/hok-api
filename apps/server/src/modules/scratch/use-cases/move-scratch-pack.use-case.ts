import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { type ScratchPackResult, toScratchPackResult } from "../mappers/scratch-pack.mapper";
import { ScratchPackRepository } from "../repositories/scratch-pack.repository";

export interface MoveScratchPackInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  packId: string;
  location: "DISPLAY" | "BACKSTOCK";
}

@Injectable()
export class MoveScratchPackUseCase {
  constructor(private readonly scratchPackRepository: ScratchPackRepository) {}

  async execute(input: MoveScratchPackInput): Promise<ScratchPackResult> {
    const pack = await this.scratchPackRepository.findById(input.packId);
    if (!pack) throw new NotFoundError("ScratchPack", input.packId);

    if (!canAccessShop(requesterScope(input), pack.shopId)) {
      throw new AuthorizationError("Access denied for this pack");
    }

    // STATE MACHINE: only ACTIVE packs can move. A FINISHED or RETURNED
    // pack is off the floor for good — moving it would misrepresent
    // where a physically-gone pack is. This is a fast-fail only — the
    // repo's updateLocationIfActive re-checks status: "ACTIVE" atomically
    // with the write, so a pack that transitions concurrently between
    // this check and the write still can't be moved.
    if (pack.status !== "ACTIVE") {
      throw new BusinessRuleError(`Cannot move a pack with status ${pack.status}`);
    }

    const updated = await this.scratchPackRepository.updateLocationIfActive(
      pack.id,
      input.location,
    );
    return toScratchPackResult(updated);
  }
}
