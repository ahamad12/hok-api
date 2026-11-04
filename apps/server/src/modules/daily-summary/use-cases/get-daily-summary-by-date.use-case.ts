import { Injectable } from "@nestjs/common";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { DailySummaryRepository } from "../repositories/daily-summary.repository";

@Injectable()
export class GetDailySummaryByDateUseCase {
  constructor(private readonly summaryRepo: DailySummaryRepository) {}

  async execute(requester: RequestUser, shopId: string, date: Date) {
    if (!canAccessShop(requester, shopId)) {
      throw new AuthorizationError("Cannot view a daily summary outside your shop");
    }
    const summary = await this.summaryRepo.findByShopAndDate(shopId, date);
    if (!summary) throw new NotFoundError("DailySummary", `${shopId}:${date.toISOString()}`);
    return summary;
  }
}
