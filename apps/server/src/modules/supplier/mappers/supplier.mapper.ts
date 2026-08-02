// modules/supplier/mappers/supplier.mapper.ts
import type { Supplier } from "@tapt-api/db";

export type SupplierResult = Pick<
  Supplier,
  | "id"
  | "shopId"
  | "categoryId"
  | "name"
  | "phone"
  | "address"
  | "isActive"
  | "createdAt"
  | "updatedAt"
>;

export function toSupplierResult(supplier: Supplier): SupplierResult {
  const { id, shopId, categoryId, name, phone, address, isActive, createdAt, updatedAt } = supplier;
  return { id, shopId, categoryId, name, phone, address, isActive, createdAt, updatedAt };
}
