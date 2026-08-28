// packages/api/src/contracts/ticket.contract.ts
import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const ticketType = z.enum(["ISSUE", "INSTRUCTION", "ANNOUNCEMENT"]);
const ticketStatus = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
const ticketPriority = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

const ticketSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  type: ticketType,
  subject: z.string(),
  status: ticketStatus,
  priority: ticketPriority,
  requiresAck: z.boolean(),
  createdById: z.string().uuid(),
  assigneeId: z.string().uuid().nullable(),
  resolvedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const messageSchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  senderId: z.string().uuid(),
  message: z.string().trim().min(1).max(5000),
  mediaUrl: z.string().url().nullable(),
  clientMessageId: z.string().uuid().nullable(),
  sequence: z.number().int(),
  createdAt: z.coerce.date(),
});

const acknowledgementRow = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  acknowledgedAt: z.coerce.date().nullable(),
});

const createTicketBody = z
  .object({
    shopId: z.string().uuid(),
    type: ticketType,
    subject: z.string().trim().min(3).max(200),
    priority: ticketPriority.optional(),
    assigneeId: z.string().uuid().optional(),
    requiresAck: z.boolean().optional(),
    body: z.string().trim().min(1).max(5000),
    clientMessageId: z.string().uuid(),
  })
  .refine((v) => v.type === "ISSUE" || !v.assigneeId, {
    message: "assigneeId is only valid for ISSUE tickets",
    path: ["assigneeId"],
  });

export const ticketContract = c.router(
  {
    create: {
      method: "POST",
      path: "/tickets",
      body: createTicketBody,
      responses: { 201: z.object({ ticket: ticketSchema, message: messageSchema }) },
    },
    getAll: {
      method: "GET",
      path: "/tickets",
      query: z.object({
        shopId: z.string().uuid(),
        type: ticketType.optional(),
        status: ticketStatus.optional(),
        priority: ticketPriority.optional(),
        assigneeId: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).default(0),
        search: z.string().optional(),
      }),
      responses: { 200: z.object({ tickets: z.array(ticketSchema), total: z.number() }) },
    },
    getById: {
      method: "GET",
      path: "/tickets/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      query: z.object({ recentMessages: z.coerce.number().int().min(0).max(50).default(20) }),
      responses: { 200: z.object({ ticket: ticketSchema, messages: z.array(messageSchema) }) },
    },
    getMessages: {
      method: "GET",
      path: "/tickets/:id/messages",
      pathParams: z.object({ id: z.string().uuid() }),
      query: z.object({
        since: z.coerce.number().int().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }),
      responses: {
        200: z.object({
          messages: z.array(messageSchema),
          nextCursor: z.number().int().nullable(),
        }),
      },
    },
    createMessage: {
      method: "POST",
      path: "/tickets/:id/messages",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({
        message: z.string().trim().min(1).max(5000),
        mediaUrl: z.string().url().optional(),
        clientMessageId: z.string().uuid(),
      }),
      responses: { 201: messageSchema },
    },
    transition: {
      method: "POST",
      path: "/tickets/:id/transition",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({ to: ticketStatus }),
      responses: {
        200: ticketSchema,
        409: z.object({ code: z.literal("CONFLICT"), allowed: z.array(ticketStatus) }),
      },
    },
    assign: {
      method: "POST",
      path: "/tickets/:id/assign",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({ assigneeId: z.string().uuid().nullable() }),
      responses: { 200: ticketSchema },
    },
    acknowledge: {
      method: "POST",
      path: "/tickets/:id/ack",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({}),
      responses: { 200: z.object({ acknowledgedAt: z.coerce.date() }) },
    },
    getAcknowledgements: {
      method: "GET",
      path: "/tickets/:id/acknowledgements",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: {
        200: z.object({
          audience: z.array(acknowledgementRow),
          totalAudience: z.number(),
          acknowledgedCount: z.number(),
        }),
      },
    },
  },
  { pathPrefix: "/api/v1" },
);
