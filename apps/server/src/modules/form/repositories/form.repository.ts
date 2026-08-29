import { Injectable } from "@nestjs/common";
import { type Form, PrismaService } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { NotFoundError } from "../../../common/errors";

@Injectable()
export class FormRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Form | null> {
    return this.prisma.form.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string): Promise<Form> {
    const form = await this.findById(id);
    if (!form) throw new NotFoundError("Form", id);
    return form;
  }

  async findAll(params: { shopId: string; isActive?: boolean }): Promise<Form[]> {
    return this.prisma.form.findMany({
      where: {
        shopId: params.shopId,
        ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  create(data: Prisma.FormUncheckedCreateInput): Promise<Form> {
    return this.prisma.form.create({ data });
  }

  // findByIdOrThrow always runs in the calling use-case before update, so a
  // P2025 (record not found) here should not be reachable in normal
  // operation — left unwrapped rather than re-thrown as NotFoundError,
  // since that would hide a genuine race condition behind a misleading 404.
  update(id: string, data: Prisma.FormUncheckedUpdateInput): Promise<Form> {
    return this.prisma.form.update({ where: { id }, data });
  }
}
