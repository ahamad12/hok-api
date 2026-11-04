import { Injectable } from "@nestjs/common";
import type { DailySummaryStatus } from "@tapt-api/db";
import { canAccessShop } from "../../../common/domain/shop-access";
import { AuthorizationError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { DailySummaryRepository } from "../repositories/daily-summary.repository";

@Injectable()
export class GetDailySummariesUseCase {
  constructor(private readonly summaryRepo: DailySummaryRepository) {}

  async execute(
    requester: RequestUser,
    query: {
      shopId: string;
      dateFrom?: Date;
      dateTo?: Date;
      status?: DailySummaryStatus;
      limit: number;
      offset: number;
    },
  ) {
    // History viewing is open to every role for their own shop — this is
    // the primary UI surface for "check older summaries," not a
    // management-only report.
    if (!canAccessShop(requester, query.shopId)) {
      throw new AuthorizationError("Cannot view daily summaries outside your shop");
    }
    return this.summaryRepo.findAll(query);
  }
}
