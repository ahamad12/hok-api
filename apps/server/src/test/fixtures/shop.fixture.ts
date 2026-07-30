import type { Shop } from "@tapt-api/db";

export function buildShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: "shop-1",
    name: "Main Branch",
    address: { street: "123 Main St", city: "Colombo" } as any,
    phone: "+94771234567",
    logoUrl: null,
    ownerId: "owner-1",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}
