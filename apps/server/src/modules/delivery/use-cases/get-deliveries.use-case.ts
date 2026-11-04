// modules/delivery/use-cases/get-deliveries.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError } from "../../../common/errors";
import {
  type DeliveryPaymentStatus,
  type DeliveryResult,
  toDeliveryResult,
} from "../mappers/delivery.mapper";
import { DeliveryRepository } from "../repositories/delivery.repository";

export interface GetDeliveriesInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  shopId: string;
  supplierId?: string;
  isVoided?: boolean;
  paymentStatus?: DeliveryPaymentStatus;
  limit: number;
  offset: number;
}

@Injectable()
export class GetDeliveriesUseCase {
  constructor(private readonly deliveryRepository: DeliveryRepository) {}

  async execute(
    input: GetDeliveriesInput,
  ): Promise<{ deliveries: DeliveryResult[]; total: number }> {
    if (!canAccessShop(requesterScope(input), input.shopId)) {
      throw new AuthorizationError("Access denied for this shop");
    }

    const { deliveries, total } = await this.deliveryRepository.findAll(
      {
        shopId: input.shopId,
        supplierId: input.supplierId,
        isVoided: input.isVoided,
        paymentStatus: input.paymentStatus,
      },
      { limit: input.limit, offset: input.offset },
    );

    const mapped = deliveries.map(toDeliveryResult);

    // Defense-in-depth: repository already filters by paymentStatus (derived
    // field) via getDeliveryPaymentStatus, but the use-case also filters the
    // mapped results so a mocked or future repository that returns unfiltered
    // rows can't leak (see get-deliveries.use-case.spec.ts).
    if (input.paymentStatus) {
      const filtered = mapped.filter((d) => d.paymentStatus === input.paymentStatus);
      const resolvedTotal = total === mapped.length ? filtered.length : total;
      return { deliveries: filtered, total: resolvedTotal };
    }

    return { deliveries: mapped, total };
  }
}
