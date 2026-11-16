// repositories/__tests__/delivery.repository.check-in.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessRuleError } from "../../../../common/errors";
import { buildDelivery } from "../../../../test/fixtures/delivery.fixture";
import { DeliveryRepository } from "../delivery.repository";

const line = (lineTotalCents: number) => ({
  productName: "Milk",
  quantityOrdered: 10,
  quantityReceived: 10,
  unit: "crate",
  unitPriceCents: lineTotalCents / 10,
  lineTotalCents,
  discrepancyNote: null,
});

function buildTx() {
  return {
    delivery: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    deliveryLineItem: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
}

describe("DeliveryRepository check-in and edit", () => {
  let tx: ReturnType<typeof buildTx>;
  let prisma: any;
  let repo: DeliveryRepository;

  beforeEach(() => {
    tx = buildTx();
    prisma = {
      delivery: { updateMany: vi.fn(), groupBy: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(async (fn: any) => fn(tx)),
    };
    repo = new DeliveryRepository(prisma);
  });

  it("updateIfPending guards on PENDING, unvoided and unpaid, and recomputes the total", async () => {
    tx.delivery.updateMany.mockResolvedValue({ count: 1 });
    tx.delivery.findUniqueOrThrow.mockResolvedValue(buildDelivery({ totalAmountCents: 5_000 }));

    await repo.updateIfPending("delivery-1", { lineItems: [line(2_000), line(3_000)] });

    expect(tx.delivery.updateMany).toHaveBeenCalledWith({
      where: { id: "delivery-1", status: "PENDING", voidedAt: null, totalPaidCents: 0 },
      data: { totalAmountCents: 5_000 },
    });
  });

  it("updateIfPending replaces every line in the same transaction", async () => {
    tx.delivery.updateMany.mockResolvedValue({ count: 1 });
    tx.delivery.findUniqueOrThrow.mockResolvedValue(buildDelivery());

    await repo.updateIfPending("delivery-1", { lineItems: [line(2_000)] });

    expect(tx.deliveryLineItem.deleteMany).toHaveBeenCalledWith({
      where: { deliveryId: "delivery-1" },
    });
    expect(tx.deliveryLineItem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ deliveryId: "delivery-1", lineTotalCents: 2_000 })],
    });
  });

  it("updateIfPending leaves lines and total alone when only the supplier changes", async () => {
    tx.delivery.updateMany.mockResolvedValue({ count: 1 });
    tx.delivery.findUniqueOrThrow.mockResolvedValue(buildDelivery());

    await repo.updateIfPending("delivery-1", { supplierId: "supplier-2" });

    expect(tx.delivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { supplierId: "supplier-2" } }),
    );
    expect(tx.deliveryLineItem.deleteMany).not.toHaveBeenCalled();
  });

  it("updateIfPending throws and writes no lines when the guard matches nothing", async () => {
    tx.delivery.updateMany.mockResolvedValue({ count: 0 });

    await expect(repo.updateIfPending("delivery-1", { lineItems: [line(2_000)] })).rejects.toThrow(
      BusinessRuleError,
    );
    expect(tx.deliveryLineItem.createMany).not.toHaveBeenCalled();
  });

  it("receiveIfPending flips PENDING to RECEIVED with who and when", async () => {
    prisma.delivery.updateMany.mockResolvedValue({ count: 1 });

    const count = await repo.receiveIfPending("delivery-1", "staff-1");

    expect(count).toBe(1);
    expect(prisma.delivery.updateMany).toHaveBeenCalledWith({
      where: { id: "delivery-1", status: "PENDING", voidedAt: null },
      data: { status: "RECEIVED", receivedAt: expect.any(Date), receivedById: "staff-1" },
    });
  });

  it("day totals only count checked-in deliveries", async () => {
    await repo.getTotalsByDeliveredAtDate("shop-1", new Date("2026-01-02"));

    expect(prisma.delivery.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "RECEIVED", voidedAt: null }),
      }),
    );
  });
});
