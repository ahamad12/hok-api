import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../../../../common/errors";
import { buildUniqueViolationError } from "../../../../test/fixtures/prisma-error.fixture";
import { buildProfitReport } from "../../../../test/fixtures/profit-report.fixture";
import { ProfitReportRepository } from "../profit-report.repository";

describe("ProfitReportRepository", () => {
  let prisma: any;
  let repo: ProfitReportRepository;

  beforeEach(() => {
    prisma = {
      profitReport: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    repo = new ProfitReportRepository(prisma);
  });

  describe("findById / findByIdOrThrow", () => {
    it("findById delegates to prisma.profitReport.findUnique", async () => {
      const report = buildProfitReport();
      prisma.profitReport.findUnique.mockResolvedValue(report);
      await expect(repo.findById("report-1")).resolves.toEqual(report);
      expect(prisma.profitReport.findUnique).toHaveBeenCalledWith({ where: { id: "report-1" } });
    });

    it("findByIdOrThrow throws NotFoundError when missing", async () => {
      prisma.profitReport.findUnique.mockResolvedValue(null);
      await expect(repo.findByIdOrThrow("missing")).rejects.toThrow(NotFoundError);
    });

    it("findByIdOrThrow returns the report when found", async () => {
      const report = buildProfitReport();
      prisma.profitReport.findUnique.mockResolvedValue(report);
      await expect(repo.findByIdOrThrow("report-1")).resolves.toEqual(report);
    });
  });

  describe("create", () => {
    it("delegates to prisma.profitReport.create with the given data", async () => {
      const input = {
        shopId: "shop-1",
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
      };
      prisma.profitReport.create.mockResolvedValue(buildProfitReport());
      await repo.create(input as any);
      expect(prisma.profitReport.create).toHaveBeenCalledWith({ data: input });
    });

    it("translates a P2002 from the live-period partial index into a ConflictError", async () => {
      prisma.profitReport.create.mockRejectedValue(
        buildUniqueViolationError(["shop_id", "period_start", "period_end"]),
      );
      await expect(repo.create({ shopId: "shop-1" } as any)).rejects.toBeInstanceOf(ConflictError);
    });

    it("rethrows non-unique errors unchanged", async () => {
      const boom = new Error("db down");
      prisma.profitReport.create.mockRejectedValue(boom);
      await expect(repo.create({ shopId: "shop-1" } as any)).rejects.toBe(boom);
    });
  });

  describe("findAll", () => {
    it("scopes by shopId and excludes voided by default", async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", limit: 20, offset: 0 });
      expect(prisma.profitReport.findMany).toHaveBeenCalledWith({
        where: { shopId: "shop-1", voidedAt: null },
        orderBy: { generatedAt: "desc" },
        take: 20,
        skip: 0,
      });
    });

    it("adds period bounds when given (gte periodStart, lte periodEnd)", async () => {
      const periodStart = new Date("2026-01-01");
      const periodEnd = new Date("2026-01-31");
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", periodStart, periodEnd, limit: 20, offset: 0 });
      expect(prisma.profitReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            periodStart: { gte: periodStart },
            periodEnd: { lte: periodEnd },
          }),
        }),
      );
    });

    it("adds only periodStart when periodEnd is omitted", async () => {
      const periodStart = new Date("2026-01-01");
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", periodStart, limit: 20, offset: 0 });
      const call = prisma.profitReport.findMany.mock.calls[0][0];
      expect(call.where).toHaveProperty("periodStart");
      expect(call.where.periodStart).toEqual({ gte: periodStart });
      expect(call.where).not.toHaveProperty("periodEnd");
    });

    it("omits both period bounds when neither is given", async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", limit: 20, offset: 0 });
      const call = prisma.profitReport.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty("periodStart");
      expect(call.where).not.toHaveProperty("periodEnd");
    });

    it("returns reports and total from the transaction result", async () => {
      const reports = [buildProfitReport()];
      prisma.$transaction.mockResolvedValue([reports, 1]);
      const result = await repo.findAll({ shopId: "shop-1", limit: 20, offset: 0 });
      expect(result).toEqual({ reports, total: 1 });
    });
  });

  describe("findLatest", () => {
    it("queries for the most recent non-voided report for the shop", async () => {
      prisma.profitReport.findFirst.mockResolvedValue(null);
      await repo.findLatest("shop-1");
      expect(prisma.profitReport.findFirst).toHaveBeenCalledWith({
        where: { shopId: "shop-1", voidedAt: null },
        orderBy: { generatedAt: "desc" },
      });
    });

    it("returns null when there are no live reports", async () => {
      prisma.profitReport.findFirst.mockResolvedValue(null);
      await expect(repo.findLatest("shop-1")).resolves.toBeNull();
    });
  });

  describe("voidIfNotVoided", () => {
    it("calls updateMany guarded on voidedAt: null, returns affected count", async () => {
      prisma.profitReport.updateMany.mockResolvedValue({ count: 1 });
      const affected = await repo.voidIfNotVoided("report-1", {
        voidedById: "user-owner-1",
        voidReason: "Duplicate period",
      });
      expect(affected).toBe(1);
      expect(prisma.profitReport.updateMany).toHaveBeenCalledWith({
        where: { id: "report-1", voidedAt: null },
        data: {
          voidedAt: expect.any(Date),
          voidedById: "user-owner-1",
          voidReason: "Duplicate period",
        },
      });
    });

    it("returns 0 when already voided", async () => {
      prisma.profitReport.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        repo.voidIfNotVoided("report-1", { voidedById: "u", voidReason: "x" }),
      ).resolves.toBe(0);
    });
  });
});
