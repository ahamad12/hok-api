// modules/delivery/use-cases/void-delivery.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { type DeliveryResult, toDeliveryResult } from "../mappers/delivery.mapper";
import { DeliveryRepository } from "../repositories/delivery.repository";

export interface VoidDeliveryInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  deliveryId: string;
  voidReason: string;
}

@Injectable()
export class VoidDeliveryUseCase {
  constructor(private readonly deliveryRepository: DeliveryRepository) {}

  async execute(input: VoidDeliveryInput): Promise<DeliveryResult> {
    const delivery = await this.deliveryRepository.findById(input.deliveryId);
    if (!delivery) throw new NotFoundError("Delivery", input.deliveryId);

    if (input.requesterRole === UserRole.STAFF && input.requesterShopId !== delivery.shopId) {
      throw new AuthorizationError("Access denied for this delivery");
    }
    if (delivery.voidedAt) throw new BusinessRuleError("This delivery has already been voided");

    // voidIfUnencumbered is the atomic guard — it re-checks "no live
    // payments" at write time, not just from the delivery.payments array
    // we already have in memory (which could be stale by the time this
    // write executes).
    const updatedCount = await this.deliveryRepository.voidIfUnencumbered(
      delivery.id,
      input.requesterId,
      input.voidReason,
    );
    if (updatedCount === 0) {
      throw new BusinessRuleError(
        "Cannot void a delivery with active payments — void the payments first",
      );
    }

    const refreshed = await this.deliveryRepository.findById(delivery.id);
    return toDeliveryResult(refreshed!);
  }
}
