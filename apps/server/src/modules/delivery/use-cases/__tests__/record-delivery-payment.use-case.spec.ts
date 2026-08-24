// use-cases/__tests__/record-delivery-payment.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import {
  buildDelivery,
  buildDeliveryWithRelations,
} from "../../../../test/fixtures/delivery.fixture";
import { buildDeliveryPayment } from "../../../../test/fixtures/delivery-payment.fixture";
import { RecordDeliveryPaymentUseCase } from "../record-delivery-payment.use-case";

describe("RecordDeliveryPaymentUseCase", () => {
  let deliveryRepository: any;
  let useCase: RecordDeliveryPaymentUseCase;

  const input = {
    requesterId: "owner-1",
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    deliveryId: "delivery-1",
    amountCents: 4_000,
    paymentMode: "CASH" as const,
  };

  beforeEach(() => {
    deliveryRepository = {
      findById: vi
        .fn()
        .mockResolvedValue(
          buildDeliveryWithRelations({ totalAmountCents: 10_000, totalPaidCents: 0 }),
        ),
      recordPaymentIfWithinBalance: vi.fn().mockResolvedValue({
        delivery: buildDelivery({ totalPaidCents: 4_000 }),
        payment: buildDeliveryPayment({ amountCents: 4_000 }),
      }),
    };
    useCase = new RecordDeliveryPaymentUseCase(deliveryRepository);
  });

  it("throws NotFoundError when the delivery doesn't exist", async () => {
    deliveryRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF targets a different shop's delivery", async () => {
    await expect(
      useCase.execute({ ...input, requesterRole: UserRole.STAFF, requesterShopId: "other-shop" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws BusinessRuleError when the delivery is voided", async () => {
    deliveryRepository.findById.mockResolvedValue(
      buildDeliveryWithRelations({ voidedAt: new Date() }),
    );
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when amountCents is not positive", async () => {
    await expect(useCase.execute({ ...input, amountCents: 0 })).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError (fast-fail) when the payment would exceed the known balance", async () => {
    deliveryRepository.findById.mockResolvedValue(
      buildDeliveryWithRelations({ totalAmountCents: 10_000, totalPaidCents: 8_000 }),
    );
    await expect(useCase.execute({ ...input, amountCents: 5_000 })).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("delegates to recordPaymentIfWithinBalance with the delivery's balance cap", async () => {
    await useCase.execute(input);
    expect(deliveryRepository.recordPaymentIfWithinBalance).toHaveBeenCalledWith(
      "delivery-1",
      10_000,
      expect.objectContaining({
        amountCents: 4_000,
        paymentMode: "CASH",
        recordedById: "owner-1",
      }),
    );
  });

  it("propagates the repo's BusinessRuleError when the guarded updateMany detects a concurrent overpayment", async () => {
    deliveryRepository.recordPaymentIfWithinBalance.mockRejectedValue(
      new BusinessRuleError("Payment would exceed the amount owed (concurrent payment detected)"),
    );
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("returns both the updated delivery and the created payment", async () => {
    const result = await useCase.execute(input);
    expect(result.payment.amountCents).toBe(4_000);
    expect(result.delivery.totalPaidCents).toBe(4_000);
  });
});
