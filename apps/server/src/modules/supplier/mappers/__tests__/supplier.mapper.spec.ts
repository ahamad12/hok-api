// modules/supplier/mappers/__tests__/supplier.mapper.spec.ts
import { describe, expect, it } from "vitest";
import { buildSupplier } from "../../../../test/fixtures/supplier.fixture";
import { toSupplierResult } from "../supplier.mapper";

describe("toSupplierResult", () => {
  it("maps all whitelisted fields", () => {
    const supplier = buildSupplier();
    expect(toSupplierResult(supplier)).toEqual({
      id: supplier.id,
      shopId: supplier.shopId,
      categoryId: supplier.categoryId,
      name: supplier.name,
      phone: supplier.phone,
      address: supplier.address,
      isActive: supplier.isActive,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    });
  });

  it("preserves null phone and address", () => {
    const supplier = buildSupplier({ phone: null, address: null });
    expect(toSupplierResult(supplier)).toMatchObject({ phone: null, address: null });
  });

  it("does not leak any field beyond the whitelisted set", () => {
    const result = toSupplierResult(buildSupplier());
    expect(Object.keys(result).sort()).toEqual(
      [
        "address",
        "categoryId",
        "createdAt",
        "id",
        "isActive",
        "name",
        "phone",
        "shopId",
        "updatedAt",
      ].sort(),
    );
  });
});
