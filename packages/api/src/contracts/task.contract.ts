// packages/api/src/contracts/task.contract.ts
import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const taskStatusSchema = z.enum(["NOT_STARTED", "IN_PROGRESS", "DONE", "BLOCKED"]);

const recurringConfigSchema = z
  .discriminatedUnion("interval", [
    z.object({ interval: z.literal("daily") }),
    z.object({ interval: z.literal("weekly"), dayOfWeek: z.number().int().min(0).max(6) }),
    z.object({ interval: z.literal("monthly"), dayOfMonth: z.number().int().min(1).max(31) }),
  ])
  .nullable();

const taskSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  assigneeId: z.string().uuid().nullable(),
  status: taskStatusSchema,
  dueDate: z.coerce.date().nullable(),
  isRecurring: z.boolean(),
  recurringConfig: recurringConfigSchema,
  priority: z.number().int(),
  createdById: z.string().uuid(),
  completedAt: z.coerce.date().nullable(),
  voidedAt: z.coerce.date().nullable(),
  voidedById: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const createTaskBodySchema = z
  .object({
    shopId: z.string().uuid(),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000).optional(),
    assigneeId: z.string().uuid().optional(),
    dueDate: z.coerce.date().optional(),
    priority: z.number().int().min(0).max(10).optional(),
    isRecurring: z.boolean().optional(),
    recurringConfig: recurringConfigSchema.optional(),
  })
  .refine((data) => !data.isRecurring || data.recurringConfig !== undefined, {
    message: "recurringConfig is required when isRecurring is true",
    path: ["recurringConfig"],
  });

const getTasksQuerySchema = z.object({
  shopId: z.string().uuid(),
  status: taskStatusSchema.optional(),
  assigneeId: z.string().uuid().optional(),
  isOverdue: z.coerce.boolean().optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const updateTaskBodySchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    priority: z.number().int().min(0).max(10).optional(),
  })
  .strict();

const voidBodySchema = z.object({
  voidReason: z.string().trim().min(3).max(500),
});

export const taskContract = c.router(
  {
    create: {
      method: "POST",
      path: "/tasks",
      body: createTaskBodySchema,
      responses: { 201: taskSchema },
    },
    getAll: {
      method: "GET",
      path: "/tasks",
      query: getTasksQuerySchema,
      responses: { 200: z.object({ tasks: z.array(taskSchema), total: z.number().int() }) },
    },
    getById: {
      method: "GET",
      path: "/tasks/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      responses: { 200: taskSchema },
    },
    update: {
      method: "PATCH",
      path: "/tasks/:id",
      pathParams: z.object({ id: z.string().uuid() }),
      body: updateTaskBodySchema,
      responses: { 200: taskSchema },
    },
    transition: {
      method: "POST",
      path: "/tasks/:id/transition",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({ to: taskStatusSchema }),
      responses: { 200: taskSchema },
    },
    assign: {
      method: "POST",
      path: "/tasks/:id/assign",
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({ assigneeId: z.string().uuid().nullable() }),
      responses: { 200: taskSchema },
    },
    voidTask: {
      method: "POST",
      path: "/tasks/:id/void",
      pathParams: z.object({ id: z.string().uuid() }),
      body: voidBodySchema,
      responses: { 200: taskSchema },
    },
  },
  { pathPrefix: "/api/v1" },
);
