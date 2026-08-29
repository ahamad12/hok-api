// modules/expense/repositories/__tests__/expense.repository.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../../common/errors";
import { buildExpense } from "../../../../test/fixtures/expense.fixture";
import { ExpenseRepository } from "../expense.repository";

describe("ExpenseRepository", () => {
  let prisma: any;
  let repo: ExpenseRepository;

  beforeEach(() => {
    prisma = {
      expense: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    repo = new ExpenseRepository(prisma);
  });

  describe("create", () => {
    it("delegates to prisma.expense.create with the given data", async () => {
      const input = {
        shopId: "shop-1",
        categoryId: "expense-category-1",
        amount: 5000,
        description: "Electricity",
        billUrl: null,
        expenseDate: new Date("2026-01-15"),
        recordedById: "user-owner-1",
      };
      prisma.expense.create.mockResolvedValue(buildExpense());
      await repo.create(input as any);
      expect(prisma.expense.create).toHaveBeenCalledWith({ data: input });
    });
  });

  describe("findById / findByIdOrThrow", () => {
    it("findById delegates to prisma.expense.findUnique", async () => {
      const expense = buildExpense();
      prisma.expense.findUnique.mockResolvedValue(expense);
      await expect(repo.findById("expense-1")).resolves.toEqual(expense);
      expect(prisma.expense.findUnique).toHaveBeenCalledWith({ where: { id: "expense-1" } });
    });

    it("findByIdOrThrow throws NotFoundError when missing", async () => {
      prisma.expense.findUnique.mockResolvedValue(null);
      await expect(repo.findByIdOrThrow("missing")).rejects.toThrow(NotFoundError);
    });

    it("findByIdOrThrow returns the expense when found", async () => {
      const expense = buildExpense();
      prisma.expense.findUnique.mockResolvedValue(expense);
      await expect(repo.findByIdOrThrow("expense-1")).resolves.toEqual(expense);
    });
  });

  describe("findAll", () => {
    it("scopes by shopId and defaults to voidedAt: null when includeVoided is omitted", async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", limit: 20, offset: 0 });
      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: { shopId: "shop-1", voidedAt: null },
        orderBy: { expenseDate: "desc" },
        take: 20,
        skip: 0,
      });
    });

    it("omits the voidedAt filter entirely when includeVoided is true", async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", includeVoided: true, limit: 20, offset: 0 });
      const call = prisma.expense.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty("voidedAt");
    });

    it("includes categoryId filter when given", async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", categoryId: "cat-1", limit: 20, offset: 0 });
      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ categoryId: "cat-1" }) }),
      );
    });

    it("builds a range filter on expenseDate when dateFrom and dateTo are both given", async () => {
      const dateFrom = new Date("2026-01-01");
      const dateTo = new Date("2026-01-31");
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", dateFrom, dateTo, limit: 20, offset: 0 });
      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ expenseDate: { gte: dateFrom, lte: dateTo } }),
        }),
      );
    });

    it("builds a one-sided range filter when only dateFrom is given", async () => {
      const dateFrom = new Date("2026-01-01");
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", dateFrom, limit: 20, offset: 0 });
      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ expenseDate: { gte: dateFrom } }),
        }),
      );
    });

    it("omits the expenseDate filter entirely when neither dateFrom nor dateTo is given", async () => {
      prisma.$transaction.mockResolvedValue([[], 0]);
      await repo.findAll({ shopId: "shop-1", limit: 20, offset: 0 });
      const call = prisma.expense.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty("expenseDate");
    });

    it("returns expenses and total from the transaction result", async () => {
      const expenses = [buildExpense()];
      prisma.$transaction.mockResolvedValue([expenses, 1]);
      const result = await repo.findAll({ shopId: "shop-1", limit: 20, offset: 0 });
      expect(result).toEqual({ expenses, total: 1 });
    });
  });

  describe("voidIfNotVoided", () => {
    it("calls updateMany guarded on voidedAt: null, returns the affected count", async () => {
      prisma.expense.updateMany.mockResolvedValue({ count: 1 });
      const affected = await repo.voidIfNotVoided("expense-1", {
        voidedById: "user-owner-1",
        voidReason: "Duplicate",
      });
      expect(affected).toBe(1);
      expect(prisma.expense.updateMany).toHaveBeenCalledWith({
        where: { id: "expense-1", voidedAt: null },
        data: expect.objectContaining({
          voidedById: "user-owner-1",
          voidReason: "Duplicate",
          voidedAt: expect.any(Date),
        }),
      });
    });

    it("returns 0 when the expense is already voided (guard doesn't match)", async () => {
      prisma.expense.updateMany.mockResolvedValue({ count: 0 });
      const affected = await repo.voidIfNotVoided("expense-1", {
        voidedById: "user-owner-1",
        voidReason: "Duplicate",
      });
      expect(affected).toBe(0);
    });
  });
});
