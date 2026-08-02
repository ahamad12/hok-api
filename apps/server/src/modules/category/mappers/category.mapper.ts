// modules/category/mappers/category.mapper.ts
import type { Category } from "@tapt-api/db";

export type CategoryResult = Pick<
  Category,
  "id" | "shopId" | "name" | "description" | "isActive" | "createdAt" | "updatedAt"
>;

export function toCategoryResult(category: Category): CategoryResult {
  const { id, shopId, name, description, isActive, createdAt, updatedAt } = category;
  return { id, shopId, name, description, isActive, createdAt, updatedAt };
}
