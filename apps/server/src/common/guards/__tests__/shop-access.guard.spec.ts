import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { describe, expect, it } from "vitest";
import { ShopAccessGuard } from "../shop-access.guard";

function contextFor(user: unknown, params: Record<string, unknown>) {
  return {
    getHandler: () => () => {},
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user, params }) }),
  } as any;
}

const guardFor = (paramKey: string | undefined) =>
  new ShopAccessGuard({ getAllAndOverride: () => paramKey } as any);

describe("ShopAccessGuard", () => {
  const owner = { userId: "o1", role: UserRole.OWNER, shopId: null, tenantShopIds: ["shop-a"] };

  it("does nothing on routes without @ShopAccess", () => {
    expect(guardFor(undefined).canActivate(contextFor(undefined, {}))).toBe(true);
  });

  it("lets an OWNER into a shop of their tenant", () => {
    expect(guardFor("id").canActivate(contextFor(owner, { id: "shop-a" }))).toBe(true);
  });

  it("keeps an OWNER out of another tenant's shop (no more OWNER/MANAGER bypass)", () => {
    expect(() => guardFor("id").canActivate(contextFor(owner, { id: "foreign-shop" }))).toThrow(
      ForbiddenException,
    );
  });

  it("keeps STAFF to their own shop", () => {
    const staff = { userId: "s1", role: UserRole.STAFF, shopId: "shop-a" };
    expect(guardFor("id").canActivate(contextFor(staff, { id: "shop-a" }))).toBe(true);
    expect(() => guardFor("id").canActivate(contextFor(staff, { id: "shop-b" }))).toThrow(
      ForbiddenException,
    );
  });

  it("rejects a missing shop param", () => {
    expect(() => guardFor("id").canActivate(contextFor(owner, {}))).toThrow(BadRequestException);
  });
});
