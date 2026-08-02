// modules/auth/repositories/user.repository.ts — kept, one method added
import { Injectable } from "@nestjs/common";
import { PrismaService, type User, UserRole } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: Prisma.UserUncheckedCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  /** Added for TokenVersionService — the one caller that needs the
   *  post-increment value back to write through to Redis. */
  async incrementTokenVersion(id: string): Promise<number> {
    const updated = await this.prisma.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });
    return updated.tokenVersion;
  }

  findByShop(shopId: string): Promise<User[]> {
    return this.prisma.user.findMany({ where: { shopId, isActive: true } });
  }

  findStaffByShop(shopId: string): Promise<User[]> {
    return this.prisma.user.findMany({ where: { shopId, role: UserRole.STAFF, isActive: true } });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }
}
