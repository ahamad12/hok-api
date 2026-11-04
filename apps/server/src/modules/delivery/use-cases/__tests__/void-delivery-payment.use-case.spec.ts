// use-cases/__tests__/void-delivery-payment.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import {
  buildDelivery,
  buildDeliveryWithRelations,
} from "../../../../test/fixtures/delivery.fixture";
import { buildDeliveryPayment } from "../../../../test/fixtures/delivery-payment.fixture";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { VoidDeliveryPaymentUseCase } from "../void-delivery-payment.use-case";

describe("VoidDeliveryPaymentUseCase", () => {
  let deliveryRepository: any;
  let deliveryPaymentRepository: any;
  let useCase: VoidDeliveryPaymentUseCase;

  const input = {
    requesterId: "owner-1",
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
    paymentId: "payment-1",
    voidReason: "duplicate entry",
  };

  beforeEach(() => {
    deliveryPaymentRepository = {
      findById: vi
        .fn()
        .mockResolvedValue(
          buildDeliveryPayment({ id: "payment-1", deliveryId: "delivery-1", amountCents: 4_000 }),
        ),
    };
    deliveryRepository = {
      findById: vi
        .fn()
        .mockResolvedValue(buildDeliveryWithRelations({ id: "delivery-1", totalPaidCents: 4_000 })),
      voidPaymentIfUnvoided: vi.fn().mockResolvedValue({
        delivery: buildDelivery({ totalPaidCents: 0 }),
        payment: buildDeliveryPayment({ voidedAt: new Date() }),
      }),
    };
    useCase = new VoidDeliveryPaymentUseCase(deliveryRepository, deliveryPaymentRepository);
  });

  it("throws NotFoundError when the payment doesn't exist", async () => {
    deliveryPaymentRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws BusinessRuleError (pre-check) when the payment is already voided", async () => {
    deliveryPaymentRepository.findById.mockResolvedValue(
      buildDeliveryPayment({ voidedAt: new Date() }),
    );
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("throws AuthorizationError when STAFF targets a different shop's delivery", async () => {
    await expect(
      useCase.execute({ ...input, requesterRole: UserRole.STAFF, requesterShopId: "other-shop" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("delegates the void to voidPaymentIfUnvoided with the payment's amount", async () => {
    await useCase.execute(input);
    expect(deliveryRepository.voidPaymentIfUnvoided).toHaveBeenCalledWith(
      "payment-1",
      "delivery-1",
      4_000,
      { voidedById: "owner-1", voidReason: "duplicate entry" },
    );
  });

  it("propagates the repo's BusinessRuleError when the guarded updateMany detects a concurrent double-void", async () => {
    deliveryRepository.voidPaymentIfUnvoided.mockRejectedValue(
      new BusinessRuleError("This payment has already been voided"),
    );
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("returns both the refreshed delivery and the voided payment", async () => {
    const result = await useCase.execute(input);
    expect(result.payment.voidedAt).not.toBeNull();
    expect(result.delivery.totalPaidCents).toBe(0);
  });
});
