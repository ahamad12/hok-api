// repositories/__tests__/delivery-payment.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDeliveryPayment } from "../../../../test/fixtures/delivery-payment.fixture";
import { DeliveryPaymentRepository } from "../delivery-payment.repository";

describe("DeliveryPaymentRepository", () => {
  let prisma: any;
  let repo: DeliveryPaymentRepository;

  beforeEach(() => {
    prisma = {
      deliveryPayment: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    };
    repo = new DeliveryPaymentRepository(prisma);
  });

  it("findById delegates to prisma.deliveryPayment.findUnique", async () => {
    const payment = buildDeliveryPayment();
    prisma.deliveryPayment.findUnique.mockResolvedValue(payment);
    await expect(repo.findById("payment-1")).resolves.toEqual(payment);
    expect(prisma.deliveryPayment.findUnique).toHaveBeenCalledWith({ where: { id: "payment-1" } });
  });

  it("findByDelivery orders newest-first by paidAt", async () => {
    prisma.deliveryPayment.findMany.mockResolvedValue([]);
    await repo.findByDelivery("delivery-1");
    expect(prisma.deliveryPayment.findMany).toHaveBeenCalledWith({
      where: { deliveryId: "delivery-1" },
      orderBy: { paidAt: "desc" },
    });
  });

  it("create delegates to prisma.deliveryPayment.create with the given data", async () => {
    const input = {
      deliveryId: "delivery-1",
      amountCents: 5000,
      paymentMode: "CASH",
      recordedById: "owner-1",
    } as any;
    prisma.deliveryPayment.create.mockResolvedValue(buildDeliveryPayment());
    await repo.create(input);
    expect(prisma.deliveryPayment.create).toHaveBeenCalledWith({ data: input });
  });
});
