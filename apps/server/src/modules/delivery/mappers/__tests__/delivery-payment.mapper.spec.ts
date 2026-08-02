// mappers/__tests__/delivery-payment.mapper.spec.ts
import { describe, expect, it } from "vitest";
import { buildDeliveryPayment } from "../../../../test/fixtures/delivery-payment.fixture";
import { toDeliveryPaymentResult } from "../delivery-payment.mapper";

describe("toDeliveryPaymentResult", () => {
  it("maps all fields including void metadata", () => {
    const voided = buildDeliveryPayment({
      voidedAt: new Date("2026-02-01"),
      voidedById: "owner-1",
      voidReason: "duplicate entry",
    });
    const result = toDeliveryPaymentResult(voided);
    expect(result.voidedAt).toEqual(new Date("2026-02-01"));
    expect(result.voidReason).toBe("duplicate entry");
  });

  it("does not leak fields beyond the whitelisted set", () => {
    const result = toDeliveryPaymentResult(buildDeliveryPayment());
    expect(Object.keys(result).sort()).toEqual(
      [
        "amountCents",
        "createdAt",
        "deliveryId",
        "id",
        "notes",
        "paidAt",
        "paymentMode",
        "recordedById",
        "voidReason",
        "voidedAt",
        "voidedById",
      ].sort(),
    );
  });
});
