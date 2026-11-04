import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { assertProfitReportAccess } from "../profit-report-access.util";
import { ProfitReportRepository } from "../repositories/profit-report.repository";

@Injectable()
export class GetProfitReportByIdUseCase {
  constructor(private readonly reportRepo: ProfitReportRepository) {}

  async execute(requester: RequestUser, id: string) {
    const report = await this.reportRepo.findByIdOrThrow(id);
    assertProfitReportAccess(requester, report.shopId);
    return report;
  }
}
