import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { assertProfitReportAccess } from "../profit-report-access.util";
import { ProfitReportRepository } from "../repositories/profit-report.repository";

@Injectable()
export class GetProfitReportsUseCase {
  constructor(private readonly reportRepo: ProfitReportRepository) {}

  async execute(
    requester: RequestUser,
    query: { shopId: string; periodStart?: Date; periodEnd?: Date; limit: number; offset: number },
  ) {
    assertProfitReportAccess(requester, query.shopId);
    return this.reportRepo.findAll(query);
  }
}
