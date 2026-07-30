// modules/till-entry/use-cases/get-till-entry-by-id.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { type TillEntryResult, toTillEntryResult } from "../mappers/till-entry.mapper";
import type { TillEntryRepository } from "../repositories/till-entry.repository";

export interface GetTillEntryByIdInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  entryId: string;
}

@Injectable()
export class GetTillEntryByIdUseCase {
  constructor(private readonly tillEntryRepository: TillEntryRepository) {}

  async execute(input: GetTillEntryByIdInput): Promise<TillEntryResult> {
    const entry = await this.tillEntryRepository.findById(input.entryId);
    if (!entry) throw new NotFoundError("TillEntry", input.entryId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== entry.shopId) {
      throw new AuthorizationError("Access denied for this entry");
    }

    return toTillEntryResult(entry);
  }
}
