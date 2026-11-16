import { Injectable } from "@nestjs/common";
import type { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError } from "../../../common/errors";
import {
  type ScratchScanEventResult,
  toScratchScanEventResult,
} from "../mappers/scratch-scan-event.mapper";
import { ScratchScanEventRepository } from "../repositories/scratch-scan-event.repository";

export interface GetScratchScansInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  shopId: string;
  date: Date;
}

export interface GetScratchScansResult {
  scans: ScratchScanEventResult[];
}

/** Scan history for one shop/day — which shifts were scanned, and by whom. */
@Injectable()
export class GetScratchScansUseCase {
  constructor(private readonly scratchScanEventRepository: ScratchScanEventRepository) {}

  async execute(input: GetScratchScansInput): Promise<GetScratchScansResult> {
    if (!canAccessShop(requesterScope(input), input.shopId)) {
      throw new AuthorizationError("Access denied for this shop");
    }
    const scans = await this.scratchScanEventRepository.findByShopAndDate(input.shopId, input.date);
    return { scans: scans.map(toScratchScanEventResult) };
  }
}
