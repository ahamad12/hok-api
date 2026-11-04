import { UserRole } from "@tapt-api/db";
import { describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { GetFormsUseCase } from "../get-forms.use-case";

function setup() {
  const formRepo = { findAll: vi.fn() };
  const useCase = new GetFormsUseCase(formRepo as any);
  return { useCase, formRepo };
}

describe("GetFormsUseCase", () => {
  it("blocks STAFF querying a different shop", async () => {
    const { useCase } = setup();
    const staff = { userId: "u1", role: UserRole.STAFF, shopId: "shop-1" };
    await expect(useCase.execute(staff as any, { shopId: "shop-2" })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("allows STAFF querying their own shop", async () => {
    const { useCase, formRepo } = setup();
    formRepo.findAll.mockResolvedValue([{ id: "f1" }]);
    const staff = { userId: "u1", role: UserRole.STAFF, shopId: "shop-1" };
    const result = await useCase.execute(staff as any, { shopId: "shop-1" });
    expect(result).toEqual([{ id: "f1" }]);
  });

  it("allows OWNER/MANAGER to query any shop", async () => {
    const { useCase, formRepo } = setup();
    formRepo.findAll.mockResolvedValue([]);
    const owner = {
      userId: "u1",
      role: UserRole.OWNER,
      shopId: "shop-1",
      tenantShopIds: TEST_TENANT_SHOP_IDS,
    };
    await expect(useCase.execute(owner as any, { shopId: "shop-999" })).resolves.toEqual([]);
  });

  it("passes isActive filter through unchanged", async () => {
    const { useCase, formRepo } = setup();
    formRepo.findAll.mockResolvedValue([]);
    const owner = {
      userId: "u1",
      role: UserRole.OWNER,
      shopId: "shop-1",
      tenantShopIds: TEST_TENANT_SHOP_IDS,
    };
    await useCase.execute(owner as any, { shopId: "shop-1", isActive: true });
    expect(formRepo.findAll).toHaveBeenCalledWith({ shopId: "shop-1", isActive: true });
  });
});
