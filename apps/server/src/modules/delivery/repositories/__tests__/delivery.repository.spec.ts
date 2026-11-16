// repositories/__tests__/delivery.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessRuleError } from "../../../../common/errors";
import { buildDeliveryWithRelations } from "../../../../test/fixtures/delivery.fixture";
import { buildDeliveryPayment } from "../../../../test/fixtures/delivery-payment.fixture";
import { DeliveryRepository } from "../delivery.repository";

function buildPrismaMock() {
  return {
    delivery: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((arg: any) =>
      typeof arg === "function" ? Promise.resolve(arg(buildTx())) : Promise.all(arg),
    ),
  };
}

function buildTx() {
  return {
    deliveryPayment: { create: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    delivery: { updateMany: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
  };
}

describe("DeliveryRepository", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let repo: DeliveryRepository;

  beforeEach(() => {
    prisma = buildPrismaMock();
    repo = new DeliveryRepository(prisma as any);
  });

  it("findById includes lineItems and payments", async () => {
    const delivery = buildDeliveryWithRelations();
    prisma.delivery.findUnique.mockResolvedValue(delivery);
    await repo.findById("delivery-1");
    expect(prisma.delivery.findUnique).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      include: { lineItems: true, payments: true },
    });
  });

  it("createWithLineItems creates the delivery with nested line items and totalPaidCents 0", async () => {
    prisma.delivery.create.mockResolvedValue(buildDeliveryWithRelations());
    await repo.createWithLineItems({
      shopId: "shop-1",
      supplierId: "supplier-1",
      billUrl: "https://example.com/bill.pdf",
      totalAmountCents: 10_000,
      deliveredById: "staff-1",
      deliveredAt: new Date("2026-01-01"),
      lineItems: [
        {
          productName: "Bread",
          quantityOrdered: 20,
          quantityReceived: 18,
          unit: "loaf",
          unitPriceCents: 500,
          lineTotalCents: 9_000,
          discrepancyNote: null,
        },
      ],
    });
    expect(prisma.delivery.create).toHaveBeenCalledWith({
      data: {
        shopId: "shop-1",
        supplierId: "supplier-1",
        billUrl: "https://example.com/bill.pdf",
        totalAmountCents: 10_000,
        totalPaidCents: 0,
        deliveredById: "staff-1",
        deliveredAt: new Date("2026-01-01"),
        lineItems: {
          create: [
            {
              productName: "Bread",
              quantityOrdered: 20,
              quantityReceived: 18,
              unit: "loaf",
              unitPriceCents: 500,
              lineTotalCents: 9_000,
              discrepancyNote: null,
            },
          ],
        },
      },
    });
  });

  it("findAll scopes by shopId and applies supplierId when given", async () => {
    prisma.delivery.findMany.mockResolvedValue([]);
    prisma.delivery.count.mockResolvedValue(0);
    await repo.findAll({ shopId: "shop-1", supplierId: "supplier-1" }, { limit: 20, offset: 0 });
    expect(prisma.delivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shopId: "shop-1", supplierId: "supplier-1" } }),
    );
  });

  it("findAll maps isVoided:true to voidedAt not-null and isVoided:false to voidedAt null", async () => {
    prisma.delivery.findMany.mockResolvedValue([]);
    prisma.delivery.count.mockResolvedValue(0);
    await repo.findAll({ shopId: "shop-1", isVoided: true }, { limit: 20, offset: 0 });
    expect(prisma.delivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shopId: "shop-1", voidedAt: { not: null } } }),
    );

    await repo.findAll({ shopId: "shop-1", isVoided: false }, { limit: 20, offset: 0 });
    expect(prisma.delivery.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { shopId: "shop-1", voidedAt: null } }),
    );
  });

  it("findAll orders by deliveredAt descending with pagination", async () => {
    prisma.delivery.findMany.mockResolvedValue([]);
    prisma.delivery.count.mockResolvedValue(0);
    await repo.findAll({ shopId: "shop-1" }, { limit: 10, offset: 20 });
    expect(prisma.delivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { deliveredAt: "desc" }, take: 10, skip: 20 }),
    );
  });

  it("getSupplierBalances groups by supplierId, excluding voided deliveries", async () => {
    prisma.delivery.groupBy.mockResolvedValue([
      { supplierId: "supplier-1", _sum: { totalAmountCents: 10_000, totalPaidCents: 4_000 } },
    ]);
    const result = await repo.getSupplierBalances("shop-1");
    expect(prisma.delivery.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shopId: "shop-1", voidedAt: null, status: "RECEIVED" } }),
    );
    expect(result).toEqual([
      { supplierId: "supplier-1", totalAmountCents: 10_000, totalPaidCents: 4_000 },
    ]);
  });

  it("getSupplierBalances defaults missing sums to 0", async () => {
    prisma.delivery.groupBy.mockResolvedValue([
      { supplierId: "supplier-2", _sum: { totalAmountCents: null, totalPaidCents: null } },
    ]);
    const result = await repo.getSupplierBalances("shop-1");
    expect(result).toEqual([{ supplierId: "supplier-2", totalAmountCents: 0, totalPaidCents: 0 }]);
  });

  it("voidIfUnencumbered requires voidedAt null AND no live payments in its WHERE clause", async () => {
    prisma.delivery.updateMany.mockResolvedValue({ count: 1 });
    await repo.voidIfUnencumbered("delivery-1", "owner-1", "wrong entry");
    expect(prisma.delivery.updateMany).toHaveBeenCalledWith({
      where: { id: "delivery-1", voidedAt: null, payments: { none: { voidedAt: null } } },
      data: expect.objectContaining({ voidedById: "owner-1", voidReason: "wrong entry" }),
    });
  });

  it("voidIfUnencumbered returns 0 when the conditional update matched nothing", async () => {
    prisma.delivery.updateMany.mockResolvedValue({ count: 0 });
    await expect(repo.voidIfUnencumbered("delivery-1", "owner-1", "reason")).resolves.toBe(0);
  });

  it("recordPaymentIfWithinBalance creates the payment, bumps totalPaidCents with the guarded updateMany, and re-reads the delivery", async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const payment = buildDeliveryPayment({ amountCents: 4_000 });
    const updated = buildDeliveryWithRelations({ totalPaidCents: 4_000 });

    tx.deliveryPayment.create.mockResolvedValue(payment);
    tx.delivery.updateMany.mockResolvedValue({ count: 1 });
    tx.delivery.findUniqueOrThrow.mockResolvedValue(updated);

    const result = await repo.recordPaymentIfWithinBalance("delivery-1", 10_000, {
      amountCents: 4_000,
      paymentMode: "CASH",
      paidAt: new Date("2026-01-02"),
      recordedById: "owner-1",
    } as any);

    expect(tx.deliveryPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deliveryId: "delivery-1", amountCents: 4_000 }),
    });
    expect(tx.delivery.updateMany).toHaveBeenCalledWith({
      where: {
        id: "delivery-1",
        status: "RECEIVED",
        totalPaidCents: { lte: 10_000 - 4_000 },
      },
      data: { totalPaidCents: { increment: 4_000 } },
    });
    expect(tx.delivery.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "delivery-1" } });
    expect(result).toEqual({ delivery: updated, payment });
  });

  it("recordPaymentIfWithinBalance throws BusinessRuleError when the guarded updateMany matches nothing (concurrent overpayment)", async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    tx.deliveryPayment.create.mockResolvedValue(buildDeliveryPayment());
    tx.delivery.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repo.recordPaymentIfWithinBalance("delivery-1", 10_000, {
        amountCents: 5_000,
        paymentMode: "CASH",
        recordedById: "owner-1",
      } as any),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("voidPaymentIfUnvoided guards the void, decrements totalPaidCents, and re-reads the payment", async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const updatedDelivery = buildDeliveryWithRelations({ totalPaidCents: 0 });
    const voided = buildDeliveryPayment({ voidedAt: new Date() });

    tx.deliveryPayment.updateMany.mockResolvedValue({ count: 1 });
    tx.delivery.update.mockResolvedValue(updatedDelivery);
    tx.deliveryPayment.findUniqueOrThrow.mockResolvedValue(voided);

    const result = await repo.voidPaymentIfUnvoided("payment-1", "delivery-1", 4_000, {
      voidedById: "owner-1",
      voidReason: "duplicate entry",
    });

    expect(tx.deliveryPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "payment-1", voidedAt: null },
      data: expect.objectContaining({
        voidedAt: expect.any(Date),
        voidedById: "owner-1",
        voidReason: "duplicate entry",
      }),
    });
    expect(tx.delivery.update).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: { totalPaidCents: { decrement: 4_000 } },
    });
    expect(tx.deliveryPayment.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "payment-1" },
    });
    expect(result).toEqual({ delivery: updatedDelivery, payment: voided });
  });

  it("voidPaymentIfUnvoided throws BusinessRuleError when the guarded updateMany matches nothing (double void)", async () => {
    const tx = buildTx();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    tx.deliveryPayment.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repo.voidPaymentIfUnvoided("payment-1", "delivery-1", 4_000, {
        voidedById: "owner-1",
        voidReason: "duplicate entry",
      }),
    ).rejects.toThrow(BusinessRuleError);
  });
});
