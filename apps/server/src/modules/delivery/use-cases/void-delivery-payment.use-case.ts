// modules/delivery/use-cases/void-delivery-payment.use-case.ts
import { Injectable } from "@nestjs/common";
import { PrismaService, UserRole } from "@tapt-api/db";
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
  paymentId: string;
  voidReason: string;
}

@Injectable()
export class VoidDeliveryPaymentUseCase {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly deliveryPaymentRepository: DeliveryPaymentRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    input: VoidDeliveryPaymentInput,
  ): Promise<{ delivery: DeliveryResult; payment: DeliveryPaymentResult }> {
    const payment = await this.deliveryPaymentRepository.findById(input.paymentId);
    if (!payment) throw new NotFoundError("DeliveryPayment", input.paymentId);
    if (payment.voidedAt) throw new BusinessRuleError("This payment has already been voided");

    const delivery = await this.deliveryRepository.findById(payment.deliveryId);
    if (!delivery) throw new NotFoundError("Delivery", payment.deliveryId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== delivery.shopId) {
      throw new AuthorizationError("Access denied for this delivery");
    }

    const { updatedDelivery, voidedPayment } = await this.prisma.$transaction(async (tx) => {
      // Same double-void race till-entry's reversal check has — two
      // concurrent void requests could both pass the pre-check above
      // before either write lands. The conditional updateMany closes it:
      // only the request that actually flips voidedAt from null wins.
      const voidResult = await tx.deliveryPayment.updateMany({
        where: { id: payment.id, voidedAt: null },
        data: { voidedAt: new Date(), voidedById: input.requesterId, voidReason: input.voidReason },
      });

      if (voidResult.count === 0) {
        throw new BusinessRuleError("This payment has already been voided");
      }

      const refreshedDelivery = await tx.delivery.update({
        where: { id: delivery.id },
        data: { totalPaidCents: { decrement: payment.amountCents } },
      });
      const refreshedPayment = await tx.deliveryPayment.findUniqueOrThrow({
        where: { id: payment.id },
      });

      return { updatedDelivery: refreshedDelivery, voidedPayment: refreshedPayment };
    });

    return {
      delivery: toDeliveryResult(updatedDelivery),
      payment: toDeliveryPaymentResult(voidedPayment),
    };
  }
}
