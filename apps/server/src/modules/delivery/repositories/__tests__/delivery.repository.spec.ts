// repositories/__tests__/delivery.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDeliveryWithRelations } from "../../../../test/fixtures/delivery.fixture";
import { DeliveryRepository } from "../delivery.repository";

function buildPrismaMock() {
  return {
    delivery: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
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
      expect.objectContaining({ where: { shopId: "shop-1", voidedAt: null } }),
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
});
