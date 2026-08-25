// apps/server/src/common/domain/task-transitions.ts
import { TaskStatus } from "@tapt-api/db";

export const TASK_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = Object.freeze({
  [TaskStatus.NOT_STARTED]: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.DONE],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.DONE, TaskStatus.BLOCKED, TaskStatus.NOT_STARTED],
  [TaskStatus.BLOCKED]: [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS],
  [TaskStatus.DONE]: [],
});

export function allowedNextStates(from: TaskStatus): readonly TaskStatus[] {
  return TASK_TRANSITIONS[from];
}

export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from].includes(to);
}
