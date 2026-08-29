import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { DailySummaryRepository } from "../repositories/daily-summary.repository";

@Injectable()
export class GetDailySummaryByIdUseCase {
  constructor(private readonly summaryRepo: DailySummaryRepository) {}

  async execute(requester: RequestUser, summaryId: string) {
    const summary = await this.summaryRepo.findByIdOrThrow(summaryId);
    if (requester.role === UserRole.STAFF && requester.shopId !== summary.shopId) {
      throw new AuthorizationError("Cannot view a daily summary outside your shop");
    }
    return summary;
  }
}
