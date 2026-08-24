// modules/category/repositories/category.repository.ts
import { Injectable } from "@nestjs/common";
import { type Category, PrismaService } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { ConflictError } from "../../../common/errors";
import { isUniqueViolation } from "../../../common/prisma/errors";

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  findAll(shopId: string, isActive?: boolean): Promise<Category[]> {
    const where: Prisma.CategoryWhereInput = { shopId };
    if (isActive !== undefined) where.isActive = isActive;
    return this.prisma.category.findMany({ where, orderBy: { name: "asc" } });
  }

  async create(data: Prisma.CategoryUncheckedCreateInput): Promise<Category> {
    try {
      return await this.prisma.category.create({ data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("A category with this name already exists for this shop");
      }
      throw error;
    }
  }

  async update(id: string, data: Prisma.CategoryUncheckedUpdateInput): Promise<Category> {
    try {
      return await this.prisma.category.update({ where: { id }, data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("A category with this name already exists for this shop");
      }
      throw error;
    }
  }
}
