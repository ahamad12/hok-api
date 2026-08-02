// mappers/__tests__/delivery.mapper.spec.ts
import { describe, expect, it } from "vitest";
import { buildDelivery } from "../../../../test/fixtures/delivery.fixture";
import { toDeliveryResult } from "../delivery.mapper";

describe("toDeliveryResult", () => {
  it("computes balanceDueCents as totalAmountCents minus totalPaidCents", () => {
    const result = toDeliveryResult(
      buildDelivery({ totalAmountCents: 10_000, totalPaidCents: 4_000 }),
    );
    expect(result.balanceDueCents).toBe(6_000);
  });

  it("flags UNPAID when totalPaidCents is 0", () => {
    const result = toDeliveryResult(buildDelivery({ totalAmountCents: 10_000, totalPaidCents: 0 }));
    expect(result.paymentStatus).toBe("UNPAID");
  });

  it("flags PARTIAL when some but not all has been paid", () => {
    const result = toDeliveryResult(
      buildDelivery({ totalAmountCents: 10_000, totalPaidCents: 4_000 }),
    );
    expect(result.paymentStatus).toBe("PARTIAL");
  });

  it("flags PAID when totalPaidCents meets or exceeds totalAmountCents", () => {
    const result = toDeliveryResult(
      buildDelivery({ totalAmountCents: 10_000, totalPaidCents: 10_000 }),
    );
    expect(result.paymentStatus).toBe("PAID");
  });

  it("does not leak fields beyond the documented shape", () => {
    const result = toDeliveryResult(buildDelivery());
    expect(Object.keys(result).sort()).toEqual(
      [
        "balanceDueCents",
        "billUrl",
        "createdAt",
        "deliveredAt",
        "deliveredById",
        "id",
        "paymentStatus",
        "shopId",
        "supplierId",
        "totalAmountCents",
        "totalPaidCents",
        "updatedAt",
        "voidReason",
        "voidedAt",
        "voidedById",
      ].sort(),
    );
  });
});
