import { UserRole } from "@tapt-api/db";
import { describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { GetFormByIdUseCase } from "../get-form-by-id.use-case";

function setup() {
  const formRepo = { findByIdOrThrow: vi.fn() };
  const useCase = new GetFormByIdUseCase(formRepo as any);
  return { useCase, formRepo };
}

describe("GetFormByIdUseCase", () => {
  it("blocks STAFF viewing a form outside their shop", async () => {
    const { useCase, formRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue({ id: "form-1", shopId: "shop-2" });
    const staff = { userId: "u1", role: UserRole.STAFF, shopId: "shop-1" };
    await expect(useCase.execute(staff as any, "form-1")).rejects.toThrow(AuthorizationError);
  });

  it("allows STAFF viewing a form in their own shop", async () => {
    const { useCase, formRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue({ id: "form-1", shopId: "shop-1" });
    const staff = { userId: "u1", role: UserRole.STAFF, shopId: "shop-1" };
    await expect(useCase.execute(staff as any, "form-1")).resolves.toEqual({
      id: "form-1",
      shopId: "shop-1",
    });
  });

  it("allows OWNER/MANAGER regardless of shop", async () => {
    const { useCase, formRepo } = setup();
    formRepo.findByIdOrThrow.mockResolvedValue({ id: "form-1", shopId: "shop-999" });
    const owner = {
      userId: "u1",
      role: UserRole.OWNER,
      shopId: "shop-1",
      tenantShopIds: TEST_TENANT_SHOP_IDS,
    };
    await expect(useCase.execute(owner as any, "form-1")).resolves.toBeDefined();
  });
});
