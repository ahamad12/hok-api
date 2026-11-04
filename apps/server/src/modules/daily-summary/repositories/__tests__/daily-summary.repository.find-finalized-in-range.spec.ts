import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDailySummary } from "../../../../test/fixtures/daily-summary.fixture";
import { DailySummaryRepository } from "../daily-summary.repository";

describe("DailySummaryRepository.findFinalizedInRange", () => {
  let prisma: any;
  let repo: DailySummaryRepository;

  beforeEach(() => {
    prisma = {
      dailySummary: { findMany: vi.fn() },
    };
    repo = new DailySummaryRepository(prisma);
  });

  it("queries for FINALIZED, non-voided summaries within the inclusive date range ordered asc", async () => {
    const dateFrom = new Date("2026-01-01");
    const dateTo = new Date("2026-01-31");
    prisma.dailySummary.findMany.mockResolvedValue([]);
    await repo.findFinalizedInRange("shop-1", dateFrom, dateTo);
    expect(prisma.dailySummary.findMany).toHaveBeenCalledWith({
      where: {
        shopId: "shop-1",
        voidedAt: null,
        status: "FINALIZED",
        date: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { date: "asc" },
    });
  });

  it("returns the matched summaries in ascending date order", async () => {
    const summaries = [
      buildDailySummary({ id: "s-1", date: new Date("2026-01-10") }),
      buildDailySummary({ id: "s-2", date: new Date("2026-01-15") }),
    ];
    prisma.dailySummary.findMany.mockResolvedValue(summaries);
    const result = await repo.findFinalizedInRange(
      "shop-1",
      new Date("2026-01-01"),
      new Date("2026-01-31"),
    );
    expect(result).toEqual(summaries);
    expect(result.map((s) => s.id)).toEqual(["s-1", "s-2"]);
  });

  it("returns an empty array when there are no finalized summaries in range", async () => {
    prisma.dailySummary.findMany.mockResolvedValue([]);
    const result = await repo.findFinalizedInRange(
      "shop-1",
      new Date("2026-01-01"),
      new Date("2026-01-31"),
    );
    expect(result).toEqual([]);
  });

  it("excludes DRAFT and voided summaries via the where clause, not post-filtering", async () => {
    // The repository must push the FINALIZED + voidedAt:null filter to the DB;
    // verify the exact where object, not the result shape.
    prisma.dailySummary.findMany.mockResolvedValue([]);
    const dateFrom = new Date("2026-01-15");
    const dateTo = new Date("2026-01-15");
    await repo.findFinalizedInRange("shop-1", dateFrom, dateTo);
    const call = prisma.dailySummary.findMany.mock.calls[0][0];
    expect(call.where.status).toBe("FINALIZED");
    expect(call.where.voidedAt).toBeNull();
    expect(call.where.date).toEqual({ gte: dateFrom, lte: dateTo });
  });
});
