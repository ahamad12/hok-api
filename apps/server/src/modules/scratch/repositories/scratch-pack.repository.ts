import { Injectable } from "@nestjs/common";
import type {
  PrismaService,
  ScratchPack,
  ScratchPackLocation,
  ScratchPackStatus,
} from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";

export interface ScratchPackFilters {
  shopId: string;
  gameId?: string;
  status?: ScratchPackStatus;
  location?: ScratchPackLocation;
}

export interface CreateScratchPackData {
  gameId: string;
  shopId: string;
  serialStart: string;
  status: ScratchPackStatus;
  location: ScratchPackLocation;
  receivedById: string;
  receivedAt: Date;
}

export interface UpdateScratchPackStatusData {
  status: ScratchPackStatus;
  finishedAt?: Date | null;
  returnedAt?: Date | null;
}

@Injectable()
export class ScratchPackRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<ScratchPack | null> {
    return this.prisma.scratchPack.findUnique({ where: { id } });
  }

  /** Used to reject receiving the same physical pack twice (same game + starting serial). */
  findByGameAndSerialStart(gameId: string, serialStart: string): Promise<ScratchPack | null> {
    return this.prisma.scratchPack.findUnique({
      where: { gameId_serialStart: { gameId, serialStart } },
    });
  }

  async findAll(
    filters: ScratchPackFilters,
    pagination: { limit: number; offset: number },
  ): Promise<{ packs: ScratchPack[]; total: number }> {
    const where: Prisma.ScratchPackWhereInput = { shopId: filters.shopId };
    if (filters.gameId) where.gameId = filters.gameId;
    if (filters.status) where.status = filters.status;
    if (filters.location) where.location = filters.location;

    const [packs, total] = await this.prisma.$transaction([
      this.prisma.scratchPack.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        take: pagination.limit,
        skip: pagination.offset,
      }),
      this.prisma.scratchPack.count({ where }),
    ]);

    return { packs, total };
  }

  create(data: CreateScratchPackData): Promise<ScratchPack> {
    return this.prisma.scratchPack.create({ data });
  }

  /** Plain field update, no history kept — per the confirmed design, moving
   *  between display/backstock is not a logged event. */
  updateLocation(id: string, location: ScratchPackLocation): Promise<ScratchPack> {
    return this.prisma.scratchPack.update({ where: { id }, data: { location } });
  }

  updateStatus(id: string, data: UpdateScratchPackStatusData): Promise<ScratchPack> {
    return this.prisma.scratchPack.update({ where: { id }, data });
  }
}
