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
  let prisma: any;
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
    };
    prisma = {
      $transaction: vi.fn(async (fn: any) =>
        fn({
          deliveryPayment: {
            create: vi.fn().mockResolvedValue(buildDeliveryPayment({ amountCents: 4_000 })),
            findUniqueOrThrow: vi.fn(),
          },
          delivery: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: vi.fn().mockResolvedValue(buildDelivery({ totalPaidCents: 4_000 })),
          },
        }),
      ),
    };
    useCase = new RecordDeliveryPaymentUseCase(deliveryRepository, prisma);
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

  it("throws BusinessRuleError when the atomic updateMany detects a concurrent overpayment (count 0)", async () => {
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        deliveryPayment: {
          create: vi.fn().mockResolvedValue(buildDeliveryPayment()),
          findUniqueOrThrow: vi.fn(),
        },
        delivery: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findUniqueOrThrow: vi.fn(),
        },
      }),
    );
    await expect(useCase.execute(input)).rejects.toThrow(BusinessRuleError);
  });

  it("increments totalPaidCents via the conditional updateMany, not a blind write", async () => {
    let capturedWhere: any;
    prisma.$transaction.mockImplementation(async (fn: any) =>
      fn({
        deliveryPayment: {
          create: vi.fn().mockResolvedValue(buildDeliveryPayment()),
          findUniqueOrThrow: vi.fn(),
        },
        delivery: {
          updateMany: vi.fn((args: any) => {
            capturedWhere = args.where;
            return { count: 1 };
          }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(buildDelivery()),
        },
      }),
    );
    await useCase.execute(input);
    expect(capturedWhere).toEqual({ id: "delivery-1", totalPaidCents: { lte: 10_000 - 4_000 } });
  });

  it("returns both the updated delivery and the created payment", async () => {
    const result = await useCase.execute(input);
    expect(result.payment.amountCents).toBe(4_000);
    expect(result.delivery.totalPaidCents).toBe(4_000);
  });
});
