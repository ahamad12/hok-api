// use-cases/__tests__/void-delivery-payment.use-case.spec.ts

import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import {
  buildDelivery,
  buildDeliveryWithRelations,
} from "../../../../test/fixtures/delivery.fixture";
import { buildDeliveryPayment } from "../../../../test/fixtures/delivery-payment.fixture";
import { VoidDeliveryPaymentUseCase } from "../void-delivery-payment.use-case";

describe("VoidDeliveryPaymentUseCase", () => {
  let deliveryRepository: any;
  let deliveryPaymentRepository: any;
  let prisma: any;
  let useCase: VoidDeliveryPaymentUseCase;

  const input = {
    requesterId: "owner-1",
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
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
    };
    prisma = {
      $transaction: vi.fn(async (fn: any) =>
        fn({
          deliveryPayment: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: vi
              .fn()
              .mockResolvedValue(buildDeliveryPayment({ voidedAt: new Date() })),
          },
          delivery: { update: vi.fn().mockResolvedValue(buildDelivery({ totalPaidCents: 0 })) },
        }),
      ),
    };
    useCase = new VoidDeliveryPaymentUseCase(deliveryRepository, deliveryPaymentRepository, prisma);
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

  it("throws BusinessRuleError when the atomic updateMany detects a concurrent double-void (count 0)", async () => {
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        deliveryPayment: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findUniqueOrThrow: vi.fn(),
        },
        delivery: { update: vi.fn() },
      }),
    );
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("decrements the delivery's totalPaidCents by exactly the voided payment's amount", async () => {
    let decrementArg: any;
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        deliveryPayment: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi
            .fn()
            .mockResolvedValue(buildDeliveryPayment({ voidedAt: new Date() })),
        },
        delivery: {
          update: vi.fn((args: any) => {
            decrementArg = args.data.totalPaidCents.decrement;
            return buildDelivery({ totalPaidCents: 0 });
          }),
        },
      }),
    );
    await useCase.execute(input);
    expect(decrementArg).toBe(4_000);
  });

  it("returns both the refreshed delivery and the voided payment", async () => {
    const result = await useCase.execute(input);
    expect(result.payment.voidedAt).not.toBeNull();
    expect(result.delivery.totalPaidCents).toBe(0);
  });
});
