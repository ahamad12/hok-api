// apps/server/src/modules/task/mappers/task.mapper.ts
import type { Task } from "@tapt-api/db";

export type TaskResult = Pick<
  Task,
  | "id"
  | "shopId"
  | "title"
  | "description"
  | "assigneeId"
  | "status"
  | "dueDate"
  | "isRecurring"
  | "recurringConfig"
  | "priority"
  | "createdById"
  | "completedAt"
  | "voidedAt"
  | "voidedById"
  | "voidReason"
  | "createdAt"
  | "updatedAt"
>;

export function toTaskResult(task: Task): TaskResult {
  const {
    id,
    shopId,
    title,
    description,
    assigneeId,
    status,
    dueDate,
    isRecurring,
    recurringConfig,
    priority,
    createdById,
    completedAt,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
    updatedAt,
  } = task;
  return {
    id,
    shopId,
    title,
    description,
    assigneeId,
    status,
    dueDate,
    isRecurring,
    recurringConfig,
    priority,
    createdById,
    completedAt,
    voidedAt,
    voidedById,
    voidReason,
    createdAt,
    updatedAt,
  };
}

export function toTaskResults(tasks: Task[]): TaskResult[] {
  return tasks.map(toTaskResult);
}
