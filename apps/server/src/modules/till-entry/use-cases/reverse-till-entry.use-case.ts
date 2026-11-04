// modules/till-entry/use-cases/reverse-till-entry.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { type TillEntryResult, toTillEntryResult } from "../mappers/till-entry.mapper";
import { TillEntryRepository } from "../repositories/till-entry.repository";

export interface ReverseTillEntryInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
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

    if (!canAccessShop(requesterScope(input), original.shopId)) {
      throw new AuthorizationError("Access denied for this entry");
    }

    if (original.reversesEntryId) {
      throw new BusinessRuleError("Cannot reverse a correction entry");
    }

    // Reversing the same entry twice is rejected atomically by the DB unique
    // constraint on reversesEntryId (NULLs allowed, one reversal per
    // entry), surfaced as a 409 ConflictError in the repository so a
    // concurrent double-reverse cannot fall through to a 500.
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
