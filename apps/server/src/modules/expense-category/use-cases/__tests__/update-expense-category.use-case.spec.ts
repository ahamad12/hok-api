// modules/expense-category/use-cases/__tests__/update-expense-category.use-case.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildExpenseCategory } from "../../../../test/fixtures/expense-category.fixture";
import { buildRequestUser } from "../../../../test/fixtures/request-user.fixture";
import { UpdateExpenseCategoryUseCase } from "../update-expense-category.use-case";

describe("UpdateExpenseCategoryUseCase", () => {
  let categoryRepo: any;
  let useCase: UpdateExpenseCategoryUseCase;

  beforeEach(() => {
    categoryRepo = {
      findByIdOrThrow: vi.fn().mockResolvedValue(buildExpenseCategory()),
      update: vi.fn().mockResolvedValue(buildExpenseCategory({ name: "Renamed" })),
    };
    useCase = new UpdateExpenseCategoryUseCase(categoryRepo);
  });

  it("throws AuthorizationError for STAFF", async () => {
    const requester = buildRequestUser({ role: "STAFF", shopId: "shop-1" });
    await expect(useCase.execute(requester, "expense-category-1", { name: "X" })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("throws NotFoundError when the category doesn't exist", async () => {
    categoryRepo.findByIdOrThrow.mockRejectedValue(new NotFoundError("ExpenseCategory", "missing"));
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "missing", { name: "X" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("checks existence before attempting the write", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), "expense-category-1", { name: "X" });
    expect(categoryRepo.findByIdOrThrow).toHaveBeenCalledWith("expense-category-1");
  });

  it("passes only the given fields through to the repository update", async () => {
    await useCase.execute(buildRequestUser({ role: "OWNER" }), "expense-category-1", {
      isActive: false,
    });
    expect(categoryRepo.update).toHaveBeenCalledWith("expense-category-1", {
      name: undefined,
      description: undefined,
      isActive: false,
    });
  });

  it("allows deactivating a category via isActive: false", async () => {
    categoryRepo.update.mockResolvedValue(buildExpenseCategory({ isActive: false }));
    const result = await useCase.execute(
      buildRequestUser({ role: "OWNER" }),
      "expense-category-1",
      { isActive: false },
    );
    expect(result.isActive).toBe(false);
  });

  it("propagates a ConflictError thrown by the repository unchanged", async () => {
    categoryRepo.update.mockRejectedValue(
      new ConflictError("An expense category with this name already exists"),
    );
    await expect(
      useCase.execute(buildRequestUser({ role: "OWNER" }), "expense-category-1", { name: "Dup" }),
    ).rejects.toThrow(ConflictError);
  });

  it("returns the updated category", async () => {
    const result = await useCase.execute(
      buildRequestUser({ role: "OWNER" }),
      "expense-category-1",
      { name: "Renamed" },
    );
    expect(result.name).toBe("Renamed");
  });
});
