import { Injectable } from "@nestjs/common";
import { PrismaService, type Shop } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { ConflictError, NotFoundError } from "../../../common/errors";
import { isNotFound, isUniqueViolation } from "../../../common/prisma/errors";

@Injectable()
export class ShopRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Shop | null> {
    return this.prisma.shop.findUnique({ where: { id } });
  }

  findByOwner(ownerId: string): Promise<Shop[]> {
    return this.prisma.shop.findMany({ where: { ownerId, isActive: true } });
  }

  async create(data: Prisma.ShopUncheckedCreateInput): Promise<Shop> {
    try {
      return await this.prisma.shop.create({ data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("You already have a shop with this name");
      }
      throw error;
    }
  }

  async update(id: string, data: Prisma.ShopUncheckedUpdateInput): Promise<Shop> {
    try {
      return await this.prisma.shop.update({ where: { id }, data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("You already have a shop with this name");
      }
      throw error;
    }
  }

  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.shop.update({ where: { id }, data: { isActive: false } });
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundError("Shop", id);
      throw error;
    }
  }
}
