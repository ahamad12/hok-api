import { UserRole } from "@tapt-api/db";
import { describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { GetSubmissionsUseCase } from "../get-submissions.use-case";

function setup() {
  const formRepo = { findByIdOrThrow: vi.fn() };
  const submissionRepo = { findAll: vi.fn() };
  const useCase = new GetSubmissionsUseCase(formRepo as any, submissionRepo as any);
  return { useCase, formRepo, submissionRepo };
}

describe("GetSubmissionsUseCase", () => {
  const query = { limit: 20, offset: 0 };

  it("blocks STAFF viewing submissions outside their shop", async () => {
    const { useCase, formRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue({ id: "form-1", shopId: "shop-2" });
    const staff = { userId: "u1", role: UserRole.STAFF, shopId: "shop-1" };
    await expect(useCase.execute(staff as any, "form-1", query)).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("scopes STAFF to their own staffId within their own shop", async () => {
    const { useCase, formRepo, submissionRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue({ id: "form-1", shopId: "shop-1" });
    submissionRepo.findAll.mockResolvedValue({ submissions: [], total: 0 });
    const staff = { userId: "u1", role: UserRole.STAFF, shopId: "shop-1" };

    await useCase.execute(staff as any, "form-1", query);

    expect(submissionRepo.findAll).toHaveBeenCalledWith({
      formId: "form-1",
      staffId: "u1",
      ...query,
    });
  });

  it("does NOT scope OWNER/MANAGER by staffId — sees every submission", async () => {
    const { useCase, formRepo, submissionRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue({ id: "form-1", shopId: "shop-1" });
    submissionRepo.findAll.mockResolvedValue({ submissions: [], total: 0 });
    const owner = {
      userId: "u-owner",
      role: UserRole.OWNER,
      shopId: "shop-999",
      tenantShopIds: TEST_TENANT_SHOP_IDS,
    };

    await useCase.execute(owner as any, "form-1", query);

    expect(submissionRepo.findAll).toHaveBeenCalledWith({ formId: "form-1", ...query });
  });
});
