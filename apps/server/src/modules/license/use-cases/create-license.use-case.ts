// modules/license/use-cases/create-license.use-case.ts
import { Injectable } from "@nestjs/common";
import { PrismaService, UserRole } from "@tapt-api/db";
import {
  AuthorizationError,
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "../../../common/errors";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { type LicenseResult, toLicenseResult } from "../mappers/license.mapper";
import { LicenseRepository } from "../repositories/license.repository";
// licenseRenewalRepository dropped — the transaction talks to tx.licenseRenewal
// directly, the injected repository was never called (C5).

export interface CreateLicenseInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  shopId: string;
  productName: string;
  licenseNumber: string;
  issueDate: Date;
  expiryDate: Date;
  remindDays?: number;
  paymentAmount?: number;
  paymentDate?: Date;
  documentUrl?: string;
  notes?: string;
}

@Injectable()
export class CreateLicenseUseCase {
  constructor(
    private readonly licenseRepository: LicenseRepository,
    private readonly shopRepository: ShopRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: CreateLicenseInput): Promise<LicenseResult> {
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
      throw new AuthorizationError("You can only register licenses for your own shop");
    }

    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    if (input.issueDate > input.expiryDate) {
      throw new BusinessRuleError("issueDate cannot be after expiryDate");
    }
    const remindDays = input.remindDays ?? 7;
    if (remindDays < 0) throw new BusinessRuleError("remindDays must be non-negative");

    if (await this.licenseRepository.existsByLicenseNumber(input.shopId, input.licenseNumber)) {
      throw new ConflictError("A license with this number already exists for this shop");
    }

    const license = await this.prisma.$transaction(async (tx) => {
      const created = await tx.license.create({
        data: {
          shopId: input.shopId,
          productName: input.productName,
          licenseNumber: input.licenseNumber,
          remindDays,
          isActive: true,
        },
      });

      const initialRenewal = await tx.licenseRenewal.create({
        data: {
          licenseId: created.id,
          source: "INITIAL",
          issueDate: input.issueDate,
          expiryDate: input.expiryDate,
          paymentAmount: input.paymentAmount ?? null,
          paymentDate: input.paymentDate ?? null,
          documentUrl: input.documentUrl ?? null,
          notes: input.notes ?? null,
          recordedById: input.requesterId,
        },
      });

      return tx.license.update({
        where: { id: created.id },
        data: {
          currentRenewalId: initialRenewal.id,
          currentIssueDate: initialRenewal.issueDate,
          currentExpiryDate: initialRenewal.expiryDate,
        },
      });
    });

    return toLicenseResult(license);
  }
}
