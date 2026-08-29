import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryRepository } from "../delivery.repository";

describe("DeliveryRepository.getTotalsByDeliveredAtDate", () => {
  let prisma: any;
  let repo: DeliveryRepository;

  beforeEach(() => {
    prisma = { delivery: { groupBy: vi.fn() } };
    repo = new DeliveryRepository(prisma);
  });

  it("groups by supplierId within the UTC day bounds of the given date, excluding voided", async () => {
    prisma.delivery.groupBy.mockResolvedValue([]);
    const date = new Date("2026-01-15T14:30:00Z");
    await repo.getTotalsByDeliveredAtDate("shop-1", date);

    const call = prisma.delivery.groupBy.mock.calls[0][0];
    expect(call.by).toEqual(["supplierId"]);
    expect(call.where.shopId).toBe("shop-1");
    expect(call.where.voidedAt).toBeNull();
    expect(call.where.deliveredAt.gte.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(call.where.deliveredAt.lte.toISOString()).toBe("2026-01-15T23:59:59.999Z");
  });

  it("defaults missing sums to 0 per supplier", async () => {
    prisma.delivery.groupBy.mockResolvedValue([
      { supplierId: "supplier-1", _sum: { totalAmountCents: null, totalPaidCents: null } },
    ]);
    const result = await repo.getTotalsByDeliveredAtDate("shop-1", new Date("2026-01-15"));
    expect(result.bySupplier).toEqual([
      { supplierId: "supplier-1", totalAmountCents: 0, totalPaidCents: 0 },
    ]);
  });

  it("sums totalAmountCents across suppliers for the grand total", async () => {
    prisma.delivery.groupBy.mockResolvedValue([
      { supplierId: "s-1", _sum: { totalAmountCents: 1000, totalPaidCents: 1000 } },
      { supplierId: "s-2", _sum: { totalAmountCents: 500, totalPaidCents: 500 } },
    ]);
    const result = await repo.getTotalsByDeliveredAtDate("shop-1", new Date("2026-01-15"));
    expect(result.totalAmountCents).toBe(1500);
  });

  it("returns an empty bySupplier and 0 total when there are no deliveries that day", async () => {
    prisma.delivery.groupBy.mockResolvedValue([]);
    const result = await repo.getTotalsByDeliveredAtDate("shop-1", new Date("2026-01-15"));
    expect(result).toEqual({ totalAmountCents: 0, bySupplier: [] });
  });
});
