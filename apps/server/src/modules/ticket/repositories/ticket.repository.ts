// apps/server/src/modules/ticket/repositories/ticket.repository.ts
import { Injectable } from "@nestjs/common";
import {
  PrismaService,
  type Ticket,
  type TicketMessage,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@tapt-api/db";
import type { Prisma } from "@tapt-api/db/prisma";
import { ConflictError, NotFoundError } from "../../../common/errors";
import { isNotFound, isUniqueViolation } from "../../../common/prisma/errors";

@Injectable()
export class TicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Ticket | null> {
    return this.prisma.ticket.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string): Promise<Ticket> {
    const ticket = await this.findById(id);
    if (!ticket) throw new NotFoundError("Ticket", id);
    return ticket;
  }

  /**
   * Atomic create of ticket + first message, idempotent on
   * (createdById, creationClientId). A client retry with the same key
   * returns the original pair — no duplicate ticket, no guessing.
   */
  async createWithInitialMessage(data: {
    shopId: string;
    type: TicketType;
    subject: string;
    priority: TicketPriority;
    requiresAck: boolean;
    createdById: string;
    assigneeId: string | null;
    body: string;
    clientMessageId: string;
  }): Promise<{ ticket: Ticket; message: TicketMessage }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const ticket = await tx.ticket.create({
          data: {
            shopId: data.shopId,
            type: data.type,
            subject: data.subject,
            priority: data.priority,
            requiresAck: data.requiresAck,
            createdById: data.createdById,
            assigneeId: data.assigneeId,
            creationClientId: data.clientMessageId,
          },
        });
        const message = await tx.ticketMessage.create({
          data: {
            ticketId: ticket.id,
            senderId: data.createdById,
            message: data.body,
            clientMessageId: data.clientMessageId,
          },
        });
        return { ticket, message };
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        const ticket = await this.prisma.ticket.findFirst({
          where: { createdById: data.createdById, creationClientId: data.clientMessageId },
        });
        if (!ticket) throw new ConflictError("Duplicate ticket creation request");

        const message = await this.prisma.ticketMessage.findFirst({
          where: { ticketId: ticket.id, clientMessageId: data.clientMessageId },
        });
        if (!message) throw new ConflictError("Duplicate ticket creation request");

        return { ticket, message };
      }
      throw e;
    }
  }

  async findAll(params: {
    shopId: string;
    type?: TicketType;
    status?: TicketStatus;
    priority?: TicketPriority;
    assigneeId?: string;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ tickets: Ticket[]; total: number }> {
    const where: Prisma.TicketWhereInput = {
      shopId: params.shopId,
      ...(params.type && { type: params.type }),
      ...(params.status && { status: params.status }),
      ...(params.priority && { priority: params.priority }),
      ...(params.assigneeId && { assigneeId: params.assigneeId }),
      ...(params.search && { subject: { contains: params.search, mode: "insensitive" } }),
    };

    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return { tickets, total };
  }

  /**
   * Guarded transition — writes only if status still equals `from`.
   * Prevents lost updates when two concurrent requests both read the
   * same stale status and both pass validation in the use-case.
   * Returns affected count; 0 means someone else moved it first.
   */
  async transitionIfStatusIn(
    id: string,
    from: TicketStatus,
    data: Prisma.TicketUncheckedUpdateInput,
  ): Promise<number> {
    const result = await this.prisma.ticket.updateMany({ where: { id, status: from }, data });
    return result.count;
  }

  async updateAssignee(id: string, assigneeId: string | null): Promise<Ticket> {
    try {
      return await this.prisma.ticket.update({ where: { id }, data: { assigneeId } });
    } catch (e) {
      if (isNotFound(e)) throw new NotFoundError("Ticket", id);
      throw e;
    }
  }
}
