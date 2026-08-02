// modules/delivery/use-cases/get-deliveries.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
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
    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== input.shopId) {
      throw new AuthorizationError("Access denied for this shop");
    }

    const { deliveries, total } = await this.deliveryRepository.findAll(
      { shopId: input.shopId, supplierId: input.supplierId, isVoided: input.isVoided },
      { limit: input.limit, offset: input.offset },
    );

    let mapped = deliveries.map(toDeliveryResult);
    if (input.paymentStatus) mapped = mapped.filter((d) => d.paymentStatus === input.paymentStatus);

    return { deliveries: mapped, total };
  }
}
