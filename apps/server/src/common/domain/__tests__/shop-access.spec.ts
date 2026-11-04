import { UserRole } from "@tapt-api/db";
import { describe, expect, it } from "vitest";
import { canAccessShop, requesterScope } from "../shop-access";

describe("canAccessShop", () => {
  const tenant = ["shop-a", "shop-b"];

  it("STAFF: only their own shop", () => {
    const staff = { role: UserRole.STAFF, shopId: "shop-a", tenantShopIds: tenant };
    expect(canAccessShop(staff, "shop-a")).toBe(true);
    expect(canAccessShop(staff, "shop-b")).toBe(false); // same tenant, different shop
  });

  it.each([
    UserRole.OWNER,
    UserRole.MANAGER,
  ])("%s: any shop of their tenant, none outside it", (role) => {
    const scope = { role, shopId: null, tenantShopIds: tenant };
    expect(canAccessShop(scope, "shop-a")).toBe(true);
    expect(canAccessShop(scope, "shop-b")).toBe(true);
    expect(canAccessShop(scope, "foreign-shop")).toBe(false);
  });

  it("fails closed when an OWNER/MANAGER's tenant shops were not resolved", () => {
    expect(canAccessShop({ role: UserRole.OWNER, shopId: null }, "shop-a")).toBe(false);
    expect(
      canAccessShop({ role: UserRole.MANAGER, shopId: null, tenantShopIds: [] }, "shop-a"),
    ).toBe(false);
  });

  it("requesterScope adapts flattened use-case inputs", () => {
    expect(
      requesterScope({
        requesterRole: UserRole.MANAGER,
        requesterShopId: null,
        requesterTenantShopIds: tenant,
      }),
    ).toEqual({ role: UserRole.MANAGER, shopId: null, tenantShopIds: tenant });
  });
});
