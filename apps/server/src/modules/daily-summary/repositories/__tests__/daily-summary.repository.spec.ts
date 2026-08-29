import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../../../../common/errors";
import { buildDailySummary } from "../../../../test/fixtures/daily-summary.fixture";
import { buildUniqueViolationError } from "../../../../test/fixtures/prisma-error.fixture";
import { DailySummaryRepository } from "../daily-summary.repository";

describe("DailySummaryRepository", () => {
  let prisma: any;
  let repo: DailySummaryRepository;

  beforeEach(() => {
    prisma = {
      dailySummary: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    repo = new DailySummaryRepository(prisma);
  });

  describe("findById / findByIdOrThrow", () => {
    it("findById delegates to prisma.dailySummary.findUnique", async () => {
      const summary = buildDailySummary();
      prisma.dailySummary.findUnique.mockResolvedValue(summary);
      await expect(repo.findById("summary-1")).resolves.toEqual(summary);
      expect(prisma.dailySummary.findUnique).toHaveBeenCalledWith({ where: { id: "summary-1" } });
    });

    it("findByIdOrThrow throws NotFoundError when missing", async () => {
      prisma.dailySummary.findUnique.mockResolvedValue(null);
      await expect(repo.findByIdOrThrow("missing")).rejects.toThrow(NotFoundError);
    });

    it("findByIdOrThrow returns the summary when found", async () => {
      const summary = buildDailySummary();
      prisma.dailySummary.findUnique.mockResolvedValue(summary);
      await expect(repo.findByIdOrThrow("summary-1")).resolves.toEqual(summary);
    });
  });

  describe("findLatestBefore", () => {
    it("queries for the most recent non-voided summary strictly before the given date", async () => {
      const date = new Date("2026-01-15");
      prisma.dailySummary.findFirst.mockResolvedValue(null);
      await repo.findLatestBefore("shop-1", date);
      expect(prisma.dailySummary.findFirst).toHaveBeenCalledWith({
        where: { shopId: "shop-1", date: { lt: date }, voidedAt: null },
        orderBy: { date: "desc" },
      });
    });

    it("returns null when there is no prior summary (first-ever close)", async () => {
      prisma.dailySummary.findFirst.mockResolvedValue(null);
      await expect(repo.findLatestBefore("shop-1", new Date("2026-01-01"))).resolves.toBeNull();
    });

    it("returns a DRAFT summary as a valid 'latest' result, not just FINALIZED", async () => {
      const draft = buildDailySummary({ status: "DRAFT" });
      prisma.dailySummary.findFirst.mockResolvedValue(draft);
      await expect(repo.findLatestBefore("shop-1", new Date("2026-01-16"))).resolves.toEqual(draft);
    });
  });

  describe("create", () => {
    it("delegates to prisma.dailySummary.create with the given data", async () => {
      const input = { shopId: "shop-1", date: new Date("2026-01-15"), status: "DRAFT" };
      prisma.dailySummary.create.mockResolvedValue(buildDailySummary());
      await repo.create(input as any);
      expect(prisma.dailySummary.create).toHaveBeenCalledWith({ data: input });
    });

    it("translates a unique violation into a ConflictError with a void-first message", async () => {
      prisma.dailySummary.create.mockRejectedValue(buildUniqueViolationError(["shop_id", "date"]));
      await expect(repo.create({ shopId: "shop-1", date: new Date() } as any)).rejects.toThrow(
        new ConflictError(
          "A daily summary for this date already exists — void it before creating a new one",
        ),
      );
    });

    it("rethrows non-unique-violation errors", async () => {
      const error = new Error("database down");
      prisma.dailySummary.create.mockRejectedValue(error);
      await expect(repo.create({ shopId: "shop-1" } as any)).rejects.toThrow(error);
    });
  });

  describe("findAll", () => {
    it("scopes by shopId and excludes voided by default", async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", limit: 30, offset: 0 });
      expect(prisma.dailySummary.findMany).toHaveBeenCalledWith({
        where: { shopId: "shop-1", voidedAt: null },
        orderBy: { date: "desc" },
        take: 30,
        skip: 0,
      });
    });

    it("includes a status filter when given", async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", status: "FINALIZED", limit: 30, offset: 0 });
      expect(prisma.dailySummary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: "FINALIZED" }) }),
      );
    });

    it("builds a date range filter when dateFrom/dateTo are given", async () => {
      const dateFrom = new Date("2026-01-01");
      const dateTo = new Date("2026-01-31");
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", dateFrom, dateTo, limit: 30, offset: 0 });
      expect(prisma.dailySummary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ date: { gte: dateFrom, lte: dateTo } }),
        }),
      );
    });

    it("omits the date filter entirely when neither bound is given", async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", limit: 30, offset: 0 });
      const call = prisma.dailySummary.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty("date");
    });

    it("returns summaries and total from the transaction result", async () => {
      const summaries = [buildDailySummary()];
      prisma.$transaction.mockResolvedValue([summaries, 1]);
      const result = await repo.findAll({ shopId: "shop-1", limit: 30, offset: 0 });
      expect(result).toEqual({ summaries, total: 1 });
    });
  });

  describe("findByShopAndDate", () => {
    it("queries with shopId, exact date, and voidedAt: null", async () => {
      const date = new Date("2026-01-15");
      prisma.dailySummary.findFirst.mockResolvedValue(null);
      await repo.findByShopAndDate("shop-1", date);
      expect(prisma.dailySummary.findFirst).toHaveBeenCalledWith({
        where: { shopId: "shop-1", date, voidedAt: null },
      });
    });

    it("returns the summary when found", async () => {
      const summary = buildDailySummary();
      prisma.dailySummary.findFirst.mockResolvedValue(summary);
      await expect(repo.findByShopAndDate("shop-1", new Date("2026-01-15"))).resolves.toEqual(
        summary,
      );
    });
  });

  describe("finalizeIfDraft", () => {
    it("calls updateMany guarded on status: DRAFT and voidedAt: null, returns affected count", async () => {
      prisma.dailySummary.updateMany.mockResolvedValue({ count: 1 });
      const affected = await repo.finalizeIfDraft("summary-1", "user-owner-1");
      expect(affected).toBe(1);
      expect(prisma.dailySummary.updateMany).toHaveBeenCalledWith({
        where: { id: "summary-1", status: "DRAFT", voidedAt: null },
        data: { status: "FINALIZED", finalizedAt: expect.any(Date), finalizedById: "user-owner-1" },
      });
    });

    it("returns 0 when the guard doesn't match (already finalized or voided)", async () => {
      prisma.dailySummary.updateMany.mockResolvedValue({ count: 0 });
      await expect(repo.finalizeIfDraft("summary-1", "user-owner-1")).resolves.toBe(0);
    });
  });

  describe("voidIfNotVoided", () => {
    it("calls updateMany guarded on voidedAt: null, returns affected count", async () => {
      prisma.dailySummary.updateMany.mockResolvedValue({ count: 1 });
      const affected = await repo.voidIfNotVoided("summary-1", {
        voidedById: "user-owner-1",
        voidReason: "Miscounted",
      });
      expect(affected).toBe(1);
      expect(prisma.dailySummary.updateMany).toHaveBeenCalledWith({
        where: { id: "summary-1", voidedAt: null },
        data: { voidedAt: expect.any(Date), voidedById: "user-owner-1", voidReason: "Miscounted" },
      });
    });

    it("returns 0 when already voided", async () => {
      prisma.dailySummary.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        repo.voidIfNotVoided("summary-1", { voidedById: "u", voidReason: "x" }),
      ).resolves.toBe(0);
    });

    it("guards status regardless of DRAFT/FINALIZED — a finalized summary can still be voided", async () => {
      prisma.dailySummary.updateMany.mockResolvedValue({ count: 1 });
      await repo.voidIfNotVoided("summary-1", { voidedById: "u", voidReason: "x" });
      const call = prisma.dailySummary.updateMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty("status"); // no status restriction — void works on either state
    });
  });
});
