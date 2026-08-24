// modules/supplier/repositories/supplier.repository.ts
// Supersedes the stub from the delivery build — same class name, same
// import path, so DeliveryModule and CreateDeliveryUseCase need no
// changes; findById keeps its original signature.
import { Injectable } from "@nestjs/common";
import { PrismaService, type Supplier } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { ConflictError } from "../../../common/errors";
import { isUniqueViolation } from "../../../common/prisma/errors";

@Injectable()
export class SupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Supplier | null> {
    return this.prisma.supplier.findUnique({ where: { id } });
  }

  findAll(
    shopId: string,
    filters: { categoryId?: string; isActive?: boolean },
  ): Promise<Supplier[]> {
    const where: Prisma.SupplierWhereInput = { shopId };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    return this.prisma.supplier.findMany({ where, orderBy: { name: "asc" } });
  }

  async create(data: Prisma.SupplierUncheckedCreateInput): Promise<Supplier> {
    try {
      return await this.prisma.supplier.create({ data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("A supplier with this name already exists for this shop");
      }
      throw error;
    }
  }

  async update(id: string, data: Prisma.SupplierUncheckedUpdateInput): Promise<Supplier> {
    try {
      return await this.prisma.supplier.update({ where: { id }, data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("A supplier with this name already exists for this shop");
      }
      throw error;
    }
  }
}
