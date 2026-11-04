// modules/delivery/use-cases/void-delivery-payment.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { type DeliveryResult, toDeliveryResult } from "../mappers/delivery.mapper";
import {
  type DeliveryPaymentResult,
  toDeliveryPaymentResult,
} from "../mappers/delivery-payment.mapper";
import { DeliveryRepository } from "../repositories/delivery.repository";
import { DeliveryPaymentRepository } from "../repositories/delivery-payment.repository";

export interface VoidDeliveryPaymentInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  paymentId: string;
  voidReason: string;
}

@Injectable()
export class VoidDeliveryPaymentUseCase {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly deliveryPaymentRepository: DeliveryPaymentRepository,
  ) {}

  async execute(
    input: VoidDeliveryPaymentInput,
  ): Promise<{ delivery: DeliveryResult; payment: DeliveryPaymentResult }> {
    const payment = await this.deliveryPaymentRepository.findById(input.paymentId);
    if (!payment) throw new NotFoundError("DeliveryPayment", input.paymentId);
    if (payment.voidedAt) throw new BusinessRuleError("This payment has already been voided");

    const delivery = await this.deliveryRepository.findById(payment.deliveryId);
    if (!delivery) throw new NotFoundError("Delivery", payment.deliveryId);

    if (!canAccessShop(requesterScope(input), delivery.shopId)) {
      throw new AuthorizationError("Access denied for this delivery");
    }

    const { delivery: updatedDelivery, payment: voidedPayment } =
      await this.deliveryRepository.voidPaymentIfUnvoided(
        payment.id,
        delivery.id,
        payment.amountCents,
        {
          voidedById: input.requesterId,
          voidReason: input.voidReason,
        },
      );

    return {
      delivery: toDeliveryResult(updatedDelivery),
      payment: toDeliveryPaymentResult(voidedPayment),
    };
  }
}
