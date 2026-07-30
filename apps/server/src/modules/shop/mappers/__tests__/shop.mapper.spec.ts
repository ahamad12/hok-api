import { describe, expect, it } from "vitest";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { toShopResult } from "../shop.mapper";

describe("toShopResult", () => {
  it("maps all expected fields from the Prisma row", () => {
    const shop = buildShop();
    const result = toShopResult(shop);
    expect(result).toEqual({
      id: shop.id,
      name: shop.name,
      address: shop.address,
      phone: shop.phone,
      logoUrl: shop.logoUrl,
      ownerId: shop.ownerId,
      isActive: shop.isActive,
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt,
    });
  });

  it("does not leak any field beyond the whitelisted set (e.g. no unexpected internal fields)", () => {
    const shop = buildShop();
    const result = toShopResult(shop);
    expect(Object.keys(result).sort()).toEqual(
      [
        "address",
        "createdAt",
        "id",
        "isActive",
        "logoUrl",
        "name",
        "ownerId",
        "phone",
        "updatedAt",
      ].sort(),
    );
  });

  it("preserves a null logoUrl rather than coercing it", () => {
    const shop = buildShop({ logoUrl: null });
    expect(toShopResult(shop).logoUrl).toBeNull();
  });
});
