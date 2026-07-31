import { Injectable } from "@nestjs/common";
import { PrismaService, type ScratchGame } from "@tapt-api/db"; // value import — `import type` breaks Nest DI at bootstrap
import type { Prisma } from "@tapt-api/db/prisma";

export interface ScratchGameFilters {
  shopId: string;
  isActive?: boolean;
}

export interface CreateScratchGameData {
  shopId: string;
  gameNumber: string | null;
  name: string;
  priceCents: number;
  ticketsPerPack: number;
}

@Injectable()
export class ScratchGameRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<ScratchGame | null> {
    return this.prisma.scratchGame.findUnique({ where: { id } });
  }

  findAll(filters: ScratchGameFilters): Promise<ScratchGame[]> {
    const where: Prisma.ScratchGameWhereInput = { shopId: filters.shopId };
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    return this.prisma.scratchGame.findMany({ where, orderBy: { name: "asc" } });
  }

  create(data: CreateScratchGameData): Promise<ScratchGame> {
    return this.prisma.scratchGame.create({ data });
  }
}
