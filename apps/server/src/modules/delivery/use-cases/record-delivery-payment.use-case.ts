// modules/delivery/use-cases/record-delivery-payment.use-case.ts
import { Injectable } from "@nestjs/common";
import { type PaymentMode, PrismaService, UserRole } from "@tapt-api/db";
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
  deliveryId: string;
  amountCents: number;
  paymentMode: PaymentMode;
  paidAt?: Date;
  notes?: string;
}

@Injectable()
export class RecordDeliveryPaymentUseCase {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    input: RecordDeliveryPaymentInput,
  ): Promise<{ delivery: DeliveryResult; payment: DeliveryPaymentResult }> {
    const delivery = await this.deliveryRepository.findById(input.deliveryId);
    if (!delivery) throw new NotFoundError("Delivery", input.deliveryId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== delivery.shopId) {
      throw new AuthorizationError("Access denied for this delivery");
    }
    if (delivery.voidedAt)
      throw new BusinessRuleError("Cannot record a payment against a voided delivery");
    if (input.amountCents <= 0) throw new BusinessRuleError("amountCents must be positive");

    // Fast-fail on the obvious case before touching the DB — the atomic
    // updateMany below is what actually closes the race (two concurrent
    // payments both reading the same pre-payment balance), this check
    // just avoids an unnecessary transaction for the common non-race case.
    if (delivery.totalPaidCents + input.amountCents > delivery.totalAmountCents) {
      throw new BusinessRuleError(
        `Payment would exceed the amount owed (balance due: ${delivery.totalAmountCents - delivery.totalPaidCents} cents)`,
      );
    }

    const { updatedDelivery, payment } = await this.prisma.$transaction(async (tx) => {
      const newPayment = await tx.deliveryPayment.create({
        data: {
          deliveryId: delivery.id,
          amountCents: input.amountCents,
          paymentMode: input.paymentMode,
          paidAt: input.paidAt ?? new Date(),
          recordedById: input.requesterId,
          notes: input.notes ?? null,
        },
      });

      // The conditional WHERE is the actual guard: only applies the
      // increment if the row's CURRENT totalPaidCents still leaves room
      // for this amount. If a concurrent payment landed between our read
      // above and this write, the condition fails, count is 0, and we
      // throw — which rolls back the payment insert too, since we're
      // inside the same interactive transaction.
      const updateResult = await tx.delivery.updateMany({
        where: {
          id: delivery.id,
          totalPaidCents: { lte: delivery.totalAmountCents - input.amountCents },
        },
        data: { totalPaidCents: { increment: input.amountCents } },
      });

      if (updateResult.count === 0) {
        throw new BusinessRuleError(
          "Payment would exceed the amount owed (concurrent payment detected)",
        );
      }

      const refreshed = await tx.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
      return { updatedDelivery: refreshed, payment: newPayment };
    });

    return {
      delivery: toDeliveryResult(updatedDelivery),
      payment: toDeliveryPaymentResult(payment),
    };
  }
}
