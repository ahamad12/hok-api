// modules/task/mappers/__tests__/task.mapper.spec.ts
import { describe, expect, it } from "vitest";
import { buildTask } from "../../../../test/fixtures/task.fixture";
import { toTaskResult, toTaskResults } from "../task.mapper";

describe("toTaskResult", () => {
  it("maps all whitelisted fields", () => {
    const task = buildTask();
    expect(toTaskResult(task)).toEqual({
      id: task.id,
      shopId: task.shopId,
      title: task.title,
      description: task.description,
      assigneeId: task.assigneeId,
      status: task.status,
      dueDate: task.dueDate,
      isRecurring: task.isRecurring,
      recurringConfig: task.recurringConfig,
      priority: task.priority,
      createdById: task.createdById,
      completedAt: task.completedAt,
      voidedAt: task.voidedAt,
      voidedById: task.voidedById,
      voidReason: task.voidReason,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    });
  });

  it("does not leak any field beyond the whitelisted set", () => {
    const result = toTaskResult(buildTask());
    expect(Object.keys(result).sort()).toEqual(
      [
        "assigneeId",
        "completedAt",
        "createdAt",
        "createdById",
        "description",
        "dueDate",
        "id",
        "isRecurring",
        "priority",
        "recurringConfig",
        "shopId",
        "status",
        "title",
        "updatedAt",
        "voidReason",
        "voidedAt",
        "voidedById",
      ].sort(),
    );
  });

  it("preserves voided fields when present", () => {
    const task = buildTask({
      voidedAt: new Date("2026-02-01T00:00:00.000Z"),
      voidedById: "manager-1",
      voidReason: "duplicate",
    });
    const result = toTaskResult(task);
    expect(result.voidedAt).toEqual(task.voidedAt);
    expect(result.voidedById).toBe("manager-1");
    expect(result.voidReason).toBe("duplicate");
  });
});

describe("toTaskResults", () => {
  it("maps an array of tasks", () => {
    const tasks = [buildTask({ id: "task-1" }), buildTask({ id: "task-2" })];
    expect(toTaskResults(tasks).map((t) => t.id)).toEqual(["task-1", "task-2"]);
  });

  it("returns empty array for empty input", () => {
    expect(toTaskResults([])).toEqual([]);
  });
});
