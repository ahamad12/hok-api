// Cross-tenant matrix: an OWNER or MANAGER of one business must not reach
// another business's shop through any module. One representative read or
// write per module; every one goes through canAccessShop.
import { UserRole } from "@tapt-api/db";
import { describe, expect, it, vi } from "vitest";
import { GetDailySummaryByIdUseCase } from "../../../modules/daily-summary/use-cases/get-daily-summary-by-id.use-case";
import { CreateExpenseUseCase } from "../../../modules/expense/use-cases/create-expense.use-case";
import { GetExpensesUseCase } from "../../../modules/expense/use-cases/get-expenses.use-case";
import { GetFormByIdUseCase } from "../../../modules/form/use-cases/get-form-by-id.use-case";
import { GetLicensesUseCase } from "../../../modules/license/use-cases/get-licenses.use-case";
import { VoidProfitReportUseCase } from "../../../modules/profit-report/use-cases/void-profit-report.use-case";
import { GetTicketByIdUseCase } from "../../../modules/ticket/use-cases/get-ticket-by-id.use-case";
import { buildRequestUser, FOREIGN_SHOP_ID } from "../../../test/fixtures/request-user.fixture";
import { AuthorizationError } from "../../errors";

const foreign = { id: "x-1", shopId: FOREIGN_SHOP_ID, voidedAt: null, type: "ISSUE" };
const repo = () => ({
  findByIdOrThrow: vi.fn().mockResolvedValue(foreign),
  findById: vi.fn().mockResolvedValue(foreign),
  findAll: vi.fn().mockResolvedValue({ licenses: [], total: 0 }),
});

describe.each([UserRole.OWNER, UserRole.MANAGER])("tenant isolation for %s", (role) => {
  const requester = buildRequestUser({ role, shopId: null });

  const cases: Array<[string, () => Promise<unknown>]> = [
    [
      "daily summary by id",
      () => new GetDailySummaryByIdUseCase(repo() as any).execute(requester, "x-1"),
    ],
    ["form by id", () => new GetFormByIdUseCase(repo() as any).execute(requester, "x-1")],
    [
      "ticket by id",
      () => new GetTicketByIdUseCase(repo() as any, repo() as any).execute(requester, "x-1", 10),
    ],
    [
      "expenses list",
      () =>
        new GetExpensesUseCase(repo() as any).execute(requester, {
          shopId: FOREIGN_SHOP_ID,
          limit: 10,
          offset: 0,
        }),
    ],
    [
      "expense create",
      () =>
        new CreateExpenseUseCase(repo() as any, repo() as any, repo() as any).execute(requester, {
          shopId: FOREIGN_SHOP_ID,
          categoryId: "c",
          amount: 100,
          description: "x",
          expenseDate: new Date(),
        } as any),
    ],
    [
      "licenses list (flattened input)",
      () =>
        new GetLicensesUseCase(repo() as any).execute({
          requesterRole: requester.role,
          requesterShopId: requester.shopId,
          requesterTenantShopIds: requester.tenantShopIds,
          shopId: FOREIGN_SHOP_ID,
          limit: 10,
          offset: 0,
        } as any),
    ],
    [
      "profit report void",
      () =>
        new VoidProfitReportUseCase(repo() as any, { emit: vi.fn() } as any).execute(
          requester,
          "x-1",
          "reason",
        ),
    ],
  ];

  it.each(cases)("%s → AuthorizationError", async (_name, run) => {
    await expect(run()).rejects.toBeInstanceOf(AuthorizationError);
  });
});
