// modules/auth/repositories/user.repository.ts — kept, one method added
import { Injectable } from "@nestjs/common";
import { PrismaService, type User, UserRole } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { ConflictError, NotFoundError } from "../../../common/errors";
import { isNotFound, isUniqueViolation } from "../../../common/prisma/errors";

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: Prisma.UserUncheckedCreateInput): Promise<User> {
    try {
      return await this.prisma.user.create({ data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const target = error.meta?.target;
        if (Array.isArray(target) && target.includes("email")) {
          throw new ConflictError("A user with this email already exists");
        }
        if (Array.isArray(target) && target.includes("username")) {
          throw new ConflictError("A user with this username already exists");
        }
        throw new ConflictError("A user with these details already exists");
      }
      throw error;
    }
  }

  async update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<User> {
    try {
      return await this.prisma.user.update({ where: { id }, data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const target = error.meta?.target;
        if (Array.isArray(target) && target.includes("email")) {
          throw new ConflictError("A user with this email already exists");
        }
        if (Array.isArray(target) && target.includes("username")) {
          throw new ConflictError("A user with this username already exists");
        }
        throw new ConflictError("A user with these details already exists");
      }
      throw error;
    }
  }

  /** Added for TokenVersionService — the one caller that needs the
   *  post-increment value back to write through to Redis. */
  async incrementTokenVersion(id: string): Promise<number> {
    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data: { tokenVersion: { increment: 1 } },
        select: { tokenVersion: true },
      });
      return updated.tokenVersion;
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundError("User", id);
      throw error;
    }
  }

  findByShop(shopId: string): Promise<User[]> {
    return this.prisma.user.findMany({ where: { shopId, isActive: true } });
  }

  findStaffByShop(shopId: string): Promise<User[]> {
    return this.prisma.user.findMany({ where: { shopId, role: UserRole.STAFF, isActive: true } });
  }

  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundError("User", id);
      throw error;
    }
  }
}
