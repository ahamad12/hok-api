// modules/till-entry/repositories/__tests__/till-entry.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTillEntry } from "../../../../test/fixtures/till-entry.fixture";
import { TillEntryRepository } from "../till-entry.repository";

function buildPrismaMock() {
  const tillEntry = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    groupBy: vi.fn(),
  };
  return {
    tillEntry,
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
}

describe("TillEntryRepository", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let repo: TillEntryRepository;

  beforeEach(() => {
    prisma = buildPrismaMock();
    repo = new TillEntryRepository(prisma as any);
  });

  it("findById delegates to prisma.tillEntry.findUnique", async () => {
    const entry = buildTillEntry();
    prisma.tillEntry.findUnique.mockResolvedValue(entry);
    await expect(repo.findById("entry-1")).resolves.toEqual(entry);
    expect(prisma.tillEntry.findUnique).toHaveBeenCalledWith({ where: { id: "entry-1" } });
  });

  it("findById returns null when no entry matches", async () => {
    prisma.tillEntry.findUnique.mockResolvedValue(null);
    await expect(repo.findById("missing")).resolves.toBeNull();
  });

  it("findReversalFor queries by reversesEntryId, not by id", async () => {
    prisma.tillEntry.findFirst.mockResolvedValue(null);
    await repo.findReversalFor("entry-1");
    expect(prisma.tillEntry.findFirst).toHaveBeenCalledWith({
      where: { reversesEntryId: "entry-1" },
    });
  });

  it("findAll applies shopId, category, and date range filters together", async () => {
    prisma.tillEntry.findMany.mockResolvedValue([]);
    prisma.tillEntry.count.mockResolvedValue(0);
    await repo.findAll(
      {
        shopId: "shop-1",
        category: "SALES",
        dateFrom: new Date("2026-07-01"),
        dateTo: new Date("2026-07-31"),
      },
      { limit: 20, offset: 0 },
    );
    expect(prisma.tillEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          shopId: "shop-1",
          category: "SALES",
          transactionDate: { gte: new Date("2026-07-01"), lte: new Date("2026-07-31") },
        },
      }),
    );
  });

  it("findAll orders by transactionDate descending and applies limit/offset", async () => {
    prisma.tillEntry.findMany.mockResolvedValue([]);
    prisma.tillEntry.count.mockResolvedValue(0);
    await repo.findAll({ shopId: "shop-1" }, { limit: 10, offset: 20 });
    expect(prisma.tillEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { transactionDate: "desc" }, take: 10, skip: 20 }),
    );
  });

  it("findAll returns entries alongside the total count", async () => {
    const entries = [buildTillEntry()];
    prisma.tillEntry.findMany.mockResolvedValue(entries);
    prisma.tillEntry.count.mockResolvedValue(1);
    await expect(repo.findAll({ shopId: "shop-1" }, { limit: 10, offset: 0 })).resolves.toEqual({
      entries,
      total: 1,
    });
  });

  it("create delegates to prisma.tillEntry.create", async () => {
    const input = {
      shopId: "shop-1",
      category: "SALES",
      amount: 1000,
      recordedById: "staff-1",
    } as any;
    prisma.tillEntry.create.mockResolvedValue(buildTillEntry());
    await repo.create(input);
    expect(prisma.tillEntry.create).toHaveBeenCalledWith({ data: input });
  });

  it("getCategoryTotals does NOT filter by reversesEntryId — reversal rows must be included to cancel originals", async () => {
    prisma.tillEntry.groupBy.mockResolvedValue([{ category: "SALES", _sum: { amount: 4000 } }]);
    await repo.getCategoryTotals("shop-1", new Date("2026-07-30"), new Date("2026-07-30"));
    const callArgs = prisma.tillEntry.groupBy.mock.calls[0]![0];
    expect(callArgs.where).not.toHaveProperty("reversesEntryId");
  });

  it("getCategoryTotals defaults a missing sum to 0 rather than null", async () => {
    prisma.tillEntry.groupBy.mockResolvedValue([{ category: "EXPENSE", _sum: { amount: null } }]);
    await expect(repo.getCategoryTotals("shop-1", new Date(), new Date())).resolves.toEqual([
      { category: "EXPENSE", totalAmount: 0 },
    ]);
  });

  it("getCategoryTotalsBefore filters strictly before the given date (lt, not lte)", async () => {
    prisma.tillEntry.groupBy.mockResolvedValue([]);
    await repo.getCategoryTotalsBefore("shop-1", new Date("2026-07-30"));
    const callArgs = prisma.tillEntry.groupBy.mock.calls[0]![0];
    expect(callArgs.where!.transactionDate).toEqual({ lt: new Date("2026-07-30") });
  });
});
