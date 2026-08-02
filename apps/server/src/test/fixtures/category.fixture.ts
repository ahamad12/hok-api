import type { Category } from "@tapt-api/db";

export function buildCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "category-1",
    shopId: "shop-1",
    name: "Bakery",
    description: null,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as Category;
}
