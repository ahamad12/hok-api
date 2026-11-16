// modules/delivery/use-cases/receive-delivery.use-case.ts
import { Injectable } from "@nestjs/common";
import { DeliveryStatus, type UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { type DeliveryResult, toDeliveryResult } from "../mappers/delivery.mapper";
import { DeliveryRepository } from "../repositories/delivery.repository";

export interface ReceiveDeliveryInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  deliveryId: string;
}

/**
 * Check-in: the stock has been counted. Locks the lines, counts the
 * delivery in day totals and makes it payable. Anyone in the shop.
 */
@Injectable()
export class ReceiveDeliveryUseCase {
  constructor(private readonly deliveryRepository: DeliveryRepository) {}

  async execute(input: ReceiveDeliveryInput): Promise<DeliveryResult> {
    const delivery = await this.deliveryRepository.findById(input.deliveryId);
    if (!delivery) throw new NotFoundError("Delivery", input.deliveryId);
    if (!canAccessShop(requesterScope(input), delivery.shopId)) {
      throw new AuthorizationError("Access denied for this delivery");
    }
    if (delivery.voidedAt) throw new BusinessRuleError("Cannot check in a voided delivery");
    if (delivery.status === DeliveryStatus.RECEIVED) {
      throw new BusinessRuleError("This delivery is already checked in");
    }

    const count = await this.deliveryRepository.receiveIfPending(delivery.id, input.requesterId);
    if (count === 0) {
      throw new BusinessRuleError("This delivery was checked in or voided meanwhile");
    }

    const refreshed = await this.deliveryRepository.findById(delivery.id);
    if (!refreshed) throw new NotFoundError("Delivery", delivery.id);
    return toDeliveryResult(refreshed);
  }
}
