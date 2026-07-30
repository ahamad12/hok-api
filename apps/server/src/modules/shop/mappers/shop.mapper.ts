import type { Shop } from "@tapt-api/db";

export type ShopResult = Pick<
  Shop,
  | "id"
  | "name"
  | "address"
  | "phone"
  | "logoUrl"
  | "ownerId"
  | "isActive"
  | "createdAt"
  | "updatedAt"
>;

export function toShopResult(shop: Shop): ShopResult {
  const { id, name, address, phone, logoUrl, ownerId, isActive, createdAt, updatedAt } = shop;
  return { id, name, address, phone, logoUrl, ownerId, isActive, createdAt, updatedAt };
}
