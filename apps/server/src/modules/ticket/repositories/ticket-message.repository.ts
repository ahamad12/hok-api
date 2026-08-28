// apps/server/src/modules/ticket/repositories/ticket-message.repository.ts
import { Injectable } from "@nestjs/common";
import { PrismaService, type TicketMessage } from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { isUniqueViolation } from "../../../common/prisma/errors";

@Injectable()
export class TicketMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent create — retry with the same clientMessageId returns the
   * original row instead of erroring or duplicating.
   */
  async createIdempotent(
    data: Prisma.TicketMessageUncheckedCreateInput & { clientMessageId: string },
  ): Promise<{ row: TicketMessage; created: boolean }> {
    const existing = await this.prisma.ticketMessage.findFirst({
      where: { ticketId: data.ticketId, clientMessageId: data.clientMessageId },
    });
    if (existing) return { row: existing, created: false };

    try {
      const row = await this.prisma.ticketMessage.create({ data });
      return { row, created: true };
    } catch (e) {
      if (isUniqueViolation(e)) {
        const row = await this.prisma.ticketMessage.findFirst({
          where: { ticketId: data.ticketId, clientMessageId: data.clientMessageId },
        });
        if (row) return { row, created: false };
      }
      throw e;
    }
  }

  /** Bounded recent window for getById's first paint — not full history. */
  async findRecentByTicketId(ticketId: string, limit: number): Promise<TicketMessage[]> {
    const rows = await this.prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { sequence: "desc" },
      take: limit,
    });
    return rows.reverse();
  }

  /** Cursor pagination — history scroll-back and reconnect gap-sync. */
  async findPage(
    ticketId: string,
    params: { since?: number; limit: number },
  ): Promise<{ messages: TicketMessage[]; nextCursor: number | null }> {
    const rows = await this.prisma.ticketMessage.findMany({
      where: { ticketId, ...(params.since !== undefined && { sequence: { gt: params.since } }) },
      orderBy: { sequence: "asc" },
      take: params.limit + 1,
    });

    const hasMore = rows.length > params.limit;
    const messages = hasMore ? rows.slice(0, params.limit) : rows;
    const last = messages.at(-1);
    const nextCursor = hasMore && last ? last.sequence : null;

    return { messages, nextCursor };
  }
}
