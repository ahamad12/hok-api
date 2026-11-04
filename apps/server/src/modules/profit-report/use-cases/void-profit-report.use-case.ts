import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { ProfitReportRepository } from "../repositories/profit-report.repository";

@Injectable()
export class VoidProfitReportUseCase {
  constructor(
    private readonly reportRepo: ProfitReportRepository,
    private readonly events: EventEmitter2,
  ) {}

  // OWNER/MANAGER only — tighter than generate/view (STAFF isSupervisor).
  async execute(requester: RequestUser, id: string, voidReason: string) {
    if (requester.role === UserRole.STAFF) {
      throw new AuthorizationError("Only OWNER/MANAGER can void a P&L report");
    }

    const report = await this.reportRepo.findByIdOrThrow(id);
    if (report.voidedAt) throw new BusinessRuleError("Report is already voided");

    const affected = await this.reportRepo.voidIfNotVoided(id, {
      voidedById: requester.userId,
      voidReason,
    });
    if (affected === 0) throw new BusinessRuleError("Report is already voided");

    const updated = await this.reportRepo.findByIdOrThrow(id);

    this.events.emit(SOCKET_EVENTS.PROFIT_REPORT_VOIDED, {
      reportId: updated.id,
      shopId: updated.shopId,
      periodStart: updated.periodStart,
      periodEnd: updated.periodEnd,
      voidedById: requester.userId,
    });

    return updated;
  }
}
