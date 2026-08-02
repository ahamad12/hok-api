// modules/license/use-cases/update-license.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { Prisma } from "@tapt-api/db/prisma";
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../../common/errors";
import { type LicenseResult, toLicenseResult } from "../mappers/license.mapper";
import { LicenseRepository } from "../repositories/license.repository";

export interface UpdateLicenseInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  licenseId: string;
  productName?: string;
  licenseNumber?: string;
  remindDays?: number;
  isActive?: boolean;
}

@Injectable()
export class UpdateLicenseUseCase {
  constructor(private readonly licenseRepository: LicenseRepository) {}

  async execute(input: UpdateLicenseInput): Promise<LicenseResult> {
    const license = await this.licenseRepository.findById(input.licenseId);
    if (!license) throw new NotFoundError("License", input.licenseId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== license.shopId) {
      throw new AuthorizationError("Access denied for this license");
    }

    if (input.remindDays !== undefined && input.remindDays < 0) {
      throw new BusinessRuleError("remindDays must be non-negative");
    }

    try {
      const updated = await this.licenseRepository.update(license.id, {
        productName: input.productName,
        licenseNumber: input.licenseNumber,
        remindDays: input.remindDays,
        isActive: input.isActive,
      });

      return toLicenseResult(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("A license with this number already exists for this shop");
      }
      throw error;
    }
  }
}
