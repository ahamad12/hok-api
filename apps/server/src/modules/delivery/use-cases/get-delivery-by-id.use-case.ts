// modules/delivery/use-cases/get-delivery-by-id.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { type DeliveryResult, toDeliveryResult } from "../mappers/delivery.mapper";
import {
  type DeliveryLineItemResult,
  toDeliveryLineItemResult,
} from "../mappers/delivery-line-item.mapper";
import {
  type DeliveryPaymentResult,
  toDeliveryPaymentResult,
} from "../mappers/delivery-payment.mapper";
import { DeliveryRepository } from "../repositories/delivery.repository";

export interface GetDeliveryByIdInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  deliveryId: string;
}

@Injectable()
export class GetDeliveryByIdUseCase {
  constructor(private readonly deliveryRepository: DeliveryRepository) {}

  async execute(input: GetDeliveryByIdInput): Promise<{
    delivery: DeliveryResult;
    lineItems: DeliveryLineItemResult[];
    payments: DeliveryPaymentResult[];
  }> {
    const delivery = await this.deliveryRepository.findById(input.deliveryId);
    if (!delivery) throw new NotFoundError("Delivery", input.deliveryId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== delivery.shopId) {
      throw new AuthorizationError("Access denied for this delivery");
    }

    return {
      delivery: toDeliveryResult(delivery),
      lineItems: delivery.lineItems.map(toDeliveryLineItemResult),
      payments: delivery.payments.map(toDeliveryPaymentResult),
    };
  }
}
