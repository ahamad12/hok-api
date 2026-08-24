import { Injectable } from "@nestjs/common";
import {
  PrismaService,
  type ScratchPack,
  type ScratchPackLocation,
  type ScratchPackStatus,
} from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { BusinessRuleError, ConflictError, NotFoundError } from "../../../common/errors";
import { isNotFound, isUniqueViolation } from "../../../common/prisma/errors";

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

  async create(data: CreateScratchPackData): Promise<ScratchPack> {
    try {
      return await this.prisma.scratchPack.create({ data });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          "A pack with this serial start has already been received for this game",
        );
      }
      throw error;
    }
  }

  /**
   * Guarded: only moves a pack that's still ACTIVE at write time, so a
   * pack concurrently RETURNED (or FINISHED) between the use-case's read
   * and this write isn't silently moved anyway — count === 0 means the
   * guard caught a race and the caller should treat it as a state
   * conflict, not a successful move. Plain field update otherwise, no
   * history kept — per the confirmed design, moving between
   * display/backstock is not a logged event.
   */
  async updateLocationIfActive(id: string, location: ScratchPackLocation): Promise<ScratchPack> {
    const result = await this.prisma.scratchPack.updateMany({
      where: { id, status: "ACTIVE" },
      data: { location },
    });
    if (result.count === 0) {
      throw new BusinessRuleError("Pack status changed before the move could be applied");
    }
    try {
      return await this.prisma.scratchPack.findUniqueOrThrow({ where: { id } });
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundError("ScratchPack", id);
      throw error;
    }
  }

  /**
   * Guarded: only applies a status transition if the pack is still
   * ACTIVE at write time, so a pack concurrently transitioned (e.g. by
   * an auto-finishing scan racing a manual return) isn't clobbered.
   * count === 0 means the guard caught a race — the caller should treat
   * that as a state conflict, not a successful transition.
   */
  async updateStatusIfActive(id: string, data: UpdateScratchPackStatusData): Promise<ScratchPack> {
    const result = await this.prisma.scratchPack.updateMany({
      where: { id, status: "ACTIVE" },
      data,
    });
    if (result.count === 0) {
      throw new BusinessRuleError("Pack status changed before this update could be applied");
    }
    try {
      return await this.prisma.scratchPack.findUniqueOrThrow({ where: { id } });
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundError("ScratchPack", id);
      throw error;
    }
  }
}
