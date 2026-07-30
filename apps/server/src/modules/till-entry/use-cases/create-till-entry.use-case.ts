// modules/till-entry/use-cases/create-till-entry.use-case.ts
import { Injectable } from "@nestjs/common";
import { type TillEntryCategory, UserRole } from "@tapt-api/db";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import type { ShopRepository } from "../../shop/repositories/shop.repository";
import { type TillEntryResult, toTillEntryResult } from "../mappers/till-entry.mapper";
import type { TillEntryRepository } from "../repositories/till-entry.repository";

export interface CreateTillEntryInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  shopId: string;
  category: TillEntryCategory;
  amount: number;
  description?: string;
  billUrl?: string;
  transactionDate?: Date;
}

@Injectable()
export class CreateTillEntryUseCase {
  constructor(
    private readonly tillEntryRepository: TillEntryRepository,
    // Not in the original plan's use-case description — added because
    // nothing else in this flow verifies the target shop exists/is
    // active before money gets recorded against it. Same gap flagged in
    // the shop module review.
    private readonly shopRepository: ShopRepository,
  ) {}

  async execute(input: CreateTillEntryInput): Promise<TillEntryResult> {
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
      throw new AuthorizationError("You can only record till entries for your own shop");
    }

    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    const entry = await this.tillEntryRepository.create({
      shopId: input.shopId,
      category: input.category,
      amount: input.amount,
      description: input.description ?? null,
      billUrl: input.billUrl ?? null,
      recordedById: input.requesterId,
      transactionDate: input.transactionDate ?? new Date(),
    });

    return toTillEntryResult(entry);
  }
}
