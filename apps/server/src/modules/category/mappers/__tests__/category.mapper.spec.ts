// modules/category/mappers/__tests__/category.mapper.spec.ts
import { describe, expect, it } from "vitest";
import { buildCategory } from "../../../../test/fixtures/category.fixture";
import { toCategoryResult } from "../category.mapper";

describe("toCategoryResult", () => {
  it("maps all whitelisted fields", () => {
    const category = buildCategory();
    expect(toCategoryResult(category)).toEqual({
      id: category.id,
      shopId: category.shopId,
      name: category.name,
      description: category.description,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    });
  });

  it("does not leak any field beyond the whitelisted set", () => {
    const result = toCategoryResult(buildCategory());
    expect(Object.keys(result).sort()).toEqual(
      ["createdAt", "description", "id", "isActive", "name", "shopId", "updatedAt"].sort(),
    );
  });
});
