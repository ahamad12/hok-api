import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { DailySummaryRepository } from "../repositories/daily-summary.repository";

@Injectable()
export class FinalizeDailySummaryUseCase {
  constructor(
    private readonly summaryRepo: DailySummaryRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(requester: RequestUser, summaryId: string) {
    if (requester.role === UserRole.STAFF) {
      throw new AuthorizationError("Only OWNER/MANAGER can finalize a daily close");
    }

    const summary = await this.summaryRepo.findByIdOrThrow(summaryId);
    if (summary.voidedAt) throw new BusinessRuleError("Cannot finalize a voided summary");
    if (summary.status === "FINALIZED") throw new BusinessRuleError("Summary is already finalized");

    const affected = await this.summaryRepo.finalizeIfDraft(summaryId, requester.userId);
    if (affected === 0) {
      throw new BusinessRuleError(
        "Summary is no longer in DRAFT — it may have been finalized or voided concurrently",
      );
    }

    const updated = await this.summaryRepo.findByIdOrThrow(summaryId);

    this.events.emit(SOCKET_EVENTS.DAILY_SUMMARY_FINALIZED, {
      summaryId: updated.id,
      shopId: updated.shopId,
      date: updated.date,
      closingBalance: updated.closingBalance,
      variance: updated.variance,
      finalizedById: requester.userId,
    });

    return updated;
  }
}
