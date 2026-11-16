import type { Delivery } from "@tapt-api/db";
import type { DeliveryWithRelations } from "../../modules/delivery/repositories/delivery.repository";
import { buildDeliveryLineItem } from "./delivery-line-item.fixture";

export function buildDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: "delivery-1",
    shopId: "shop-1",
    supplierId: "supplier-1",
    billUrl: null,
    totalAmountCents: 10_000,
    totalPaidCents: 0,
    status: "RECEIVED",
    receivedAt: new Date("2026-01-01"),
    receivedById: "staff-1",
    deliveredById: "staff-1",
    deliveredAt: new Date("2026-01-01"),
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as Delivery;
}

export function buildDeliveryWithRelations(
  overrides: Partial<DeliveryWithRelations> = {},
): DeliveryWithRelations {
  const delivery = buildDelivery(overrides);
  return {
    ...delivery,
    lineItems: overrides.lineItems ?? [buildDeliveryLineItem({ deliveryId: delivery.id })],
    payments: overrides.payments ?? [],
  };
}
