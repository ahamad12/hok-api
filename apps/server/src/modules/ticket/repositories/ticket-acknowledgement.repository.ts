// apps/server/src/modules/ticket/repositories/ticket-acknowledgement.repository.ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "@tapt-api/db";

@Injectable()
export class TicketAcknowledgementRepository {
  constructor(private readonly prisma: PrismaService) {}

  // idempotent — re-acking is a no-op, doesn't move the timestamp
  async acknowledge(ticketId: string, userId: string): Promise<Date> {
    const row = await this.prisma.ticketAcknowledgement.upsert({
      where: { ticketId_userId: { ticketId, userId } },
      update: {},
      create: { ticketId, userId },
    });
    return row.acknowledgedAt;
  }

  async findByTicketId(ticketId: string): Promise<Map<string, Date>> {
    const rows = await this.prisma.ticketAcknowledgement.findMany({ where: { ticketId } });
    return new Map(rows.map((r) => [r.userId, r.acknowledgedAt]));
  }
}
