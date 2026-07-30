import { Injectable } from "@nestjs/common";
import type { PrismaService, Shop } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";

@Injectable()
export class ShopRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Shop | null> {
    return this.prisma.shop.findUnique({ where: { id } });
  }

  findByOwner(ownerId: string): Promise<Shop[]> {
    return this.prisma.shop.findMany({ where: { ownerId, isActive: true } });
  }

  create(data: Record<string, unknown>): Promise<Shop> {
    return this.prisma.shop.create({ data: data as Prisma.ShopUncheckedCreateInput });
  }

  update(id: string, data: Record<string, unknown>): Promise<Shop> {
    return this.prisma.shop.update({
      where: { id },
      data: data as Prisma.ShopUncheckedUpdateInput,
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.shop.update({ where: { id }, data: { isActive: false } });
  }

  async existsByNameForOwner(name: string, ownerId: string): Promise<boolean> {
    const count = await this.prisma.shop.count({ where: { name, ownerId } });
    return count > 0;
  }
}
