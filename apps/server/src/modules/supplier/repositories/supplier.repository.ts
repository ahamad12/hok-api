// modules/supplier/repositories/supplier.repository.ts
// Supersedes the stub from the delivery build — same class name, same
// import path, so DeliveryModule and CreateDeliveryUseCase need no
// changes; findById keeps its original signature.
import { Injectable } from "@nestjs/common";
import { PrismaService, type Supplier } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";

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

  create(data: Prisma.SupplierUncheckedCreateInput): Promise<Supplier> {
    return this.prisma.supplier.create({ data });
  }

  update(id: string, data: Prisma.SupplierUncheckedUpdateInput): Promise<Supplier> {
    return this.prisma.supplier.update({ where: { id }, data });
  }
}
