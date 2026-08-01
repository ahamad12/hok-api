// modules/license/use-cases/get-expiring-licenses.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError } from "../../../common/errors";
import { type LicenseResult, toLicenseResult } from "../mappers/license.mapper";
import { LicenseRepository } from "../repositories/license.repository";

export interface GetExpiringLicensesInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  shopId: string;
}

@Injectable()
export class GetExpiringLicensesUseCase {
  constructor(private readonly licenseRepository: LicenseRepository) {}

  async execute(input: GetExpiringLicensesInput): Promise<{ licenses: LicenseResult[] }> {
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
      throw new AuthorizationError("Access denied for this shop");
    }

    const today = new Date();
    // Now scoped at the query level via the repository's optional shopId
    // param — previously fetched every shop's candidates and filtered
    // in memory (minor perf note from the review).
    const candidates = await this.licenseRepository.findCandidatesForReminder(today, input.shopId);
    const licenses = candidates
      .map((l) => toLicenseResult(l, today))
      .filter((l) => l.isExpiringSoon);

    return { licenses };
  }
}
