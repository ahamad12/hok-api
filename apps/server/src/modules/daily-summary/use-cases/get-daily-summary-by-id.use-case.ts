import { Injectable } from "@nestjs/common";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { DailySummaryRepository } from "../repositories/daily-summary.repository";

@Injectable()
export class GetDailySummaryByIdUseCase {
  constructor(private readonly summaryRepo: DailySummaryRepository) {}

  async execute(requester: RequestUser, summaryId: string) {
    const summary = await this.summaryRepo.findByIdOrThrow(summaryId);
    if (!canAccessShop(requester, summary.shopId)) {
      throw new AuthorizationError("Cannot view a daily summary outside your shop");
    }
    return summary;
  }
}
