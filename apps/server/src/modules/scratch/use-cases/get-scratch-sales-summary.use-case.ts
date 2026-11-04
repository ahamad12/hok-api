import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError } from "../../../common/errors";
import { ScratchScanEventRepository } from "../repositories/scratch-scan-event.repository";

export interface GetScratchSalesSummaryInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  shopId: string;
  dateFrom: Date;
  dateTo: Date;
}

export interface ScratchSalesSummaryResult {
  shopId: string;
  dateFrom: Date;
  dateTo: Date;
  totalTicketsSold: number;
  totalRevenueCents: number;
  byGame: Array<{ gameId: string; ticketsSold: number; revenueCents: number }>;
}

@Injectable()
export class GetScratchSalesSummaryUseCase {
  constructor(private readonly scratchScanEventRepository: ScratchScanEventRepository) {}

  async execute(input: GetScratchSalesSummaryInput): Promise<ScratchSalesSummaryResult> {
    if (!canAccessShop(requesterScope(input), input.shopId)) {
      throw new AuthorizationError("Access denied for this shop");
    }

    const byGame = await this.scratchScanEventRepository.getSummaryByGame(
      input.shopId,
      input.dateFrom,
      input.dateTo,
    );

    return {
      shopId: input.shopId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      totalTicketsSold: byGame.reduce((sum, g) => sum + g.ticketsSold, 0),
      totalRevenueCents: byGame.reduce((sum, g) => sum + g.revenueCents, 0),
      byGame,
    };
  }
}
