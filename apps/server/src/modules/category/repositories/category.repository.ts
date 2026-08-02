// modules/category/repositories/category.repository.ts
import { Injectable } from "@nestjs/common";
import { type Category, PrismaService } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";

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

  create(data: Prisma.CategoryUncheckedCreateInput): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  update(id: string, data: Prisma.CategoryUncheckedUpdateInput): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data });
  }
}
