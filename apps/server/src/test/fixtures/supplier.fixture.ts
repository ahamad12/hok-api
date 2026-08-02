import type { Supplier } from "@tapt-api/db";

export function buildSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: "supplier-1",
    shopId: "shop-1",
    categoryId: "category-1",
    name: "Acme Wholesale",
    phone: "555-0100",
    address: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  } as Supplier;
}
