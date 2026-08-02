// modules/delivery/use-cases/get-supplier-outstanding.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError } from "../../../common/errors";
import { DeliveryRepository } from "../repositories/delivery.repository";

export interface GetSupplierOutstandingInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  shopId: string;
}

export interface SupplierOutstandingResult {
  supplierId: string;
  totalAmountCents: number;
  totalPaidCents: number;
  outstandingCents: number;
}

@Injectable()
export class GetSupplierOutstandingUseCase {
  constructor(private readonly deliveryRepository: DeliveryRepository) {}

  async execute(
    input: GetSupplierOutstandingInput,
  ): Promise<{ balances: SupplierOutstandingResult[] }> {
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
      throw new AuthorizationError("Access denied for this shop");
    }

    const raw = await this.deliveryRepository.getSupplierBalances(input.shopId);
    const balances = raw.map((r) => ({
      ...r,
      outstandingCents: r.totalAmountCents - r.totalPaidCents,
    }));

    return { balances };
  }
}
