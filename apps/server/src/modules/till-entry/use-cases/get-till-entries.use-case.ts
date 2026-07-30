// modules/till-entry/use-cases/get-till-entries.use-case.ts
import { Injectable } from "@nestjs/common";
import { type TillEntryCategory, UserRole } from "@tapt-api/db";
import { AuthorizationError } from "../../../common/errors";
import { type TillEntryResult, toTillEntryResult } from "../mappers/till-entry.mapper";
import type { TillEntryRepository } from "../repositories/till-entry.repository";

export interface GetTillEntriesInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  shopId: string;
  category?: TillEntryCategory;
  dateFrom?: Date;
  dateTo?: Date;
  limit: number;
  offset: number;
}

export interface GetTillEntriesResult {
  entries: TillEntryResult[];
  total: number;
}

@Injectable()
export class GetTillEntriesUseCase {
  constructor(private readonly tillEntryRepository: TillEntryRepository) {}

  async execute(input: GetTillEntriesInput): Promise<GetTillEntriesResult> {
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
      throw new AuthorizationError("Access denied for this shop");
    }

    const { entries, total } = await this.tillEntryRepository.findAll(
      {
        shopId: input.shopId,
        category: input.category,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
      },
      { limit: input.limit, offset: input.offset },
    );

    return { entries: entries.map(toTillEntryResult), total };
  }
}
