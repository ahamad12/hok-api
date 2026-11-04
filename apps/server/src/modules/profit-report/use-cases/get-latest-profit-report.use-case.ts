import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { assertProfitReportAccess } from "../profit-report-access.util";
import { ProfitReportRepository } from "../repositories/profit-report.repository";

@Injectable()
export class GetLatestProfitReportUseCase {
  constructor(private readonly reportRepo: ProfitReportRepository) {}

  async execute(requester: RequestUser, shopId: string) {
    assertProfitReportAccess(requester, shopId);
    return this.reportRepo.findLatest(shopId);
  }
}
