// modules/delivery/use-cases/record-delivery-payment.use-case.ts
import { Injectable } from "@nestjs/common";
import { type PaymentMode, UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { type DeliveryResult, toDeliveryResult } from "../mappers/delivery.mapper";
import {
  type DeliveryPaymentResult,
  toDeliveryPaymentResult,
} from "../mappers/delivery-payment.mapper";
import { DeliveryRepository } from "../repositories/delivery.repository";

export interface RecordDeliveryPaymentInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  deliveryId: string;
  amountCents: number;
  paymentMode: PaymentMode;
  paidAt?: Date;
  notes?: string;
}

@Injectable()
export class RecordDeliveryPaymentUseCase {
  constructor(private readonly deliveryRepository: DeliveryRepository) {}

  async execute(
    input: RecordDeliveryPaymentInput,
  ): Promise<{ delivery: DeliveryResult; payment: DeliveryPaymentResult }> {
    const delivery = await this.deliveryRepository.findById(input.deliveryId);
    if (!delivery) throw new NotFoundError("Delivery", input.deliveryId);

    if (!canAccessShop(requesterScope(input), delivery.shopId)) {
      throw new AuthorizationError("Access denied for this delivery");
    }
    if (delivery.voidedAt)
      throw new BusinessRuleError("Cannot record a payment against a voided delivery");
    if (input.amountCents <= 0) throw new BusinessRuleError("amountCents must be positive");

    // Fast-fail on the obvious case before touching the DB — the repo's
    // guarded updateMany is what actually closes the race (two
    // concurrent payments both reading the same pre-payment balance),
    // this check just avoids an unnecessary transaction for the common
    // non-race case.
    if (delivery.totalPaidCents + input.amountCents > delivery.totalAmountCents) {
      throw new BusinessRuleError(
        `Payment would exceed the amount owed (balance due: ${delivery.totalAmountCents - delivery.totalPaidCents} cents)`,
      );
    }

    const { delivery: updatedDelivery, payment } =
      await this.deliveryRepository.recordPaymentIfWithinBalance(
        delivery.id,
        delivery.totalAmountCents,
        {
          amountCents: input.amountCents,
          paymentMode: input.paymentMode,
          paidAt: input.paidAt ?? new Date(),
          recordedById: input.requesterId,
          notes: input.notes ?? null,
        },
      );

    return {
      delivery: toDeliveryResult(updatedDelivery),
      payment: toDeliveryPaymentResult(payment),
    };
  }
}
