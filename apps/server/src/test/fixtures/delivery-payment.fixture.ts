import type { DeliveryPayment } from "@tapt-api/db";

export function buildDeliveryPayment(overrides: Partial<DeliveryPayment> = {}): DeliveryPayment {
  return {
    id: "payment-1",
    deliveryId: "delivery-1",
    amountCents: 5_000,
    paymentMode: "CASH",
    paidAt: new Date("2026-01-02"),
    recordedById: "owner-1",
    notes: null,
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    createdAt: new Date("2026-01-02"),
    ...overrides,
  } as DeliveryPayment;
}
