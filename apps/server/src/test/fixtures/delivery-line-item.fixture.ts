import type { DeliveryLineItem } from "@tapt-api/db";

export function buildDeliveryLineItem(overrides: Partial<DeliveryLineItem> = {}): DeliveryLineItem {
  return {
    id: "line-item-1",
    deliveryId: "delivery-1",
    productName: "Bread, White Loaf",
    quantityOrdered: 20,
    quantityReceived: 20,
    unit: "loaf",
    unitPriceCents: 500,
    lineTotalCents: 10_000,
    discrepancyNote: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  } as DeliveryLineItem;
}
