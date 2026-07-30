// modules/till-entry/use-cases/reverse-till-entry.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../../common/errors";
import { type TillEntryResult, toTillEntryResult } from "../mappers/till-entry.mapper";
import type { TillEntryRepository } from "../repositories/till-entry.repository";

export interface ReverseTillEntryInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  entryId: string;
  correctionReason: string;
  description?: string;
}

@Injectable()
export class ReverseTillEntryUseCase {
  constructor(private readonly tillEntryRepository: TillEntryRepository) {}

  async execute(input: ReverseTillEntryInput): Promise<TillEntryResult> {
    const original = await this.tillEntryRepository.findById(input.entryId);
    if (!original) throw new NotFoundError("TillEntry", input.entryId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== original.shopId) {
      throw new AuthorizationError("Access denied for this entry");
    }

    if (original.reversesEntryId) {
      throw new BusinessRuleError("Cannot reverse a correction entry");
    }

    // Not in the plan's literal use-case description — added to close the
    // "reverse the same mistake twice" gap flagged in the original design
    // discussion. Application-level only; a true concurrent-request race
    // needs a partial unique index on reversesEntryId at the DB level.
    const existingReversal = await this.tillEntryRepository.findReversalFor(input.entryId);
    if (existingReversal) throw new ConflictError("This entry has already been reversed");

    const reversal = await this.tillEntryRepository.create({
      shopId: original.shopId,
      category: original.category,
      // NEGATED — see TillEntryRepository.getCategoryTotals for why this
      // is required for a reversal to actually cancel the original rather
      // than double it.
      amount: -original.amount,
      description: input.description ?? `Reversal of: ${original.description ?? original.id}`,
      recordedById: input.requesterId,
      transactionDate: new Date(),
      reversesEntryId: input.entryId,
      correctionReason: input.correctionReason,
    });

    return toTillEntryResult(reversal);
  }
}
