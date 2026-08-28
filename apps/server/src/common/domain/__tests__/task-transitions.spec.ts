// apps/server/src/common/domain/__tests__/task-transitions.spec.ts

import { TaskStatus } from "@tapt-api/db";
import { describe, expect, it } from "vitest";
import { allowedNextStates, isValidTransition, TASK_TRANSITIONS } from "../task-transitions";

describe("task-transitions", () => {
  it("DONE is terminal — no outgoing transitions", () => {
    expect(TASK_TRANSITIONS[TaskStatus.DONE]).toEqual([]);
    expect(allowedNextStates(TaskStatus.DONE)).toHaveLength(0);
  });

  it.each([
    [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS, true],
    [TaskStatus.NOT_STARTED, TaskStatus.BLOCKED, true],
    [TaskStatus.NOT_STARTED, TaskStatus.DONE, true],
    [TaskStatus.IN_PROGRESS, TaskStatus.NOT_STARTED, true],
    [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, true],
    [TaskStatus.IN_PROGRESS, TaskStatus.DONE, true],
    [TaskStatus.BLOCKED, TaskStatus.NOT_STARTED, true],
    [TaskStatus.BLOCKED, TaskStatus.IN_PROGRESS, true],
    [TaskStatus.BLOCKED, TaskStatus.DONE, false],
    [TaskStatus.DONE, TaskStatus.NOT_STARTED, false],
    [TaskStatus.DONE, TaskStatus.IN_PROGRESS, false],
    [TaskStatus.DONE, TaskStatus.BLOCKED, false],
  ])("%s -> %s is valid: %s", (from, to, expected) => {
    expect(isValidTransition(from, to)).toBe(expected);
  });
});
