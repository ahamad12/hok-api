import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { DailySummaryRepository } from "../repositories/daily-summary.repository";

@Injectable()
export class GetDailySummaryByDateUseCase {
  constructor(private readonly summaryRepo: DailySummaryRepository) {}

  async execute(requester: RequestUser, shopId: string, date: Date) {
    if (requester.role === UserRole.STAFF && requester.shopId !== shopId) {
      throw new AuthorizationError("Cannot view a daily summary outside your shop");
    }
    const summary = await this.summaryRepo.findByShopAndDate(shopId, date);
    if (!summary) throw new NotFoundError("DailySummary", `${shopId}:${date.toISOString()}`);
    return summary;
  }
}
