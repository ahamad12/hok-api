import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, BusinessRuleError } from "../../../common/errors";
import type { RequestUser } from "../../../common/types/request-user.interface";
import { DailySummaryRepository } from "../repositories/daily-summary.repository";

@Injectable()
export class VoidDailySummaryUseCase {
  constructor(
    private readonly summaryRepo: DailySummaryRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(requester: RequestUser, summaryId: string, voidReason: string) {
    if (requester.role === UserRole.STAFF) {
      throw new AuthorizationError("Only OWNER/MANAGER can void a daily close");
    }

    const summary = await this.summaryRepo.findByIdOrThrow(summaryId);
    if (summary.voidedAt) throw new BusinessRuleError("Summary is already voided");

    const affected = await this.summaryRepo.voidIfNotVoided(summaryId, {
      voidedById: requester.userId,
      voidReason,
    });
    if (affected === 0) throw new BusinessRuleError("Summary is already voided");

    const updated = await this.summaryRepo.findByIdOrThrow(summaryId);

    this.events.emit(SOCKET_EVENTS.DAILY_SUMMARY_VOIDED, {
      summaryId: updated.id,
      shopId: updated.shopId,
      date: updated.date,
      voidedById: requester.userId,
    });

    return updated;
  }
}
