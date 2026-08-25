import type { Task } from "@tapt-api/db";

export function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    shopId: "shop-1",
    title: "Stock check",
    description: null,
    assigneeId: null,
    status: "NOT_STARTED" as const,
    dueDate: null,
    isRecurring: false,
    recurringConfig: null,
    priority: 0,
    createdById: "owner-1",
    completedAt: null,
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Task;
}
