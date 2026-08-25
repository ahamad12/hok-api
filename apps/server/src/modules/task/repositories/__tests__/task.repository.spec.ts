// repositories/__tests__/task.repository.spec.ts

import { TaskStatus } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "../../../../common/errors";
import { buildUniqueViolationError } from "../../../../test/fixtures/prisma-error.fixture";
import { buildTask } from "../../../../test/fixtures/task.fixture";
import { TaskRepository } from "../task.repository";

describe("TaskRepository", () => {
  let prisma: any;
  let repo: TaskRepository;

  beforeEach(() => {
    prisma = {
      task: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    repo = new TaskRepository(prisma);
  });

  it("findById delegates to prisma.task.findUnique", async () => {
    const task = buildTask();
    prisma.task.findUnique.mockResolvedValue(task);
    await expect(repo.findById("task-1")).resolves.toEqual(task);
    expect(prisma.task.findUnique).toHaveBeenCalledWith({ where: { id: "task-1" } });
  });

  it("create delegates to prisma.task.create with the given data", async () => {
    const input = {
      shopId: "shop-1",
      title: "Stock check",
      description: null,
      assigneeId: null,
      dueDate: null,
      isRecurring: false,
      recurringConfig: null as any,
      priority: 0,
      createdById: "owner-1",
    };
    prisma.task.create.mockResolvedValue(buildTask());
    await repo.create(input);
    expect(prisma.task.create).toHaveBeenCalledWith({ data: input });
  });

  it("update delegates to prisma.task.update with the given id and data", async () => {
    const data = { title: "Updated" } as any;
    prisma.task.update.mockResolvedValue(buildTask({ title: "Updated" }));
    await repo.update("task-1", data);
    expect(prisma.task.update).toHaveBeenCalledWith({ where: { id: "task-1" }, data });
  });

  it("findAll excludes voided tasks and orders by priority desc, dueDate asc, createdAt desc", async () => {
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);
    await repo.findAll({ shopId: "shop-1", limit: 10, offset: 0 });
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shopId: "shop-1", voidedAt: null }),
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        take: 10,
        skip: 0,
      }),
    );
    expect(prisma.task.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ voidedAt: null }),
    });
  });

  it("findAll applies status, assigneeId and search filters", async () => {
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);
    await repo.findAll({
      shopId: "shop-1",
      status: "IN_PROGRESS" as any,
      assigneeId: "staff-1",
      search: "stock",
      limit: 10,
      offset: 0,
    });
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "IN_PROGRESS",
          assigneeId: "staff-1",
          title: { contains: "stock", mode: "insensitive" },
        }),
      }),
    );
  });

  it("findAll handles isOverdue alone as dueDate < now and status not DONE", async () => {
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);
    await repo.findAll({ shopId: "shop-1", isOverdue: true, limit: 10, offset: 0 });
    const where = prisma.task.findMany.mock.calls[0][0].where;
    expect(where.dueDate).toEqual({ lt: expect.any(Date) });
    expect(where.status).toEqual({ notIn: ["DONE"] });
  });

  it("findAll merges status and isOverdue via AND so neither is lost", async () => {
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);
    await repo.findAll({
      shopId: "shop-1",
      status: "IN_PROGRESS" as any,
      isOverdue: true,
      limit: 10,
      offset: 0,
    });
    const where = prisma.task.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual([{ status: "IN_PROGRESS" }, { status: { notIn: ["DONE"] } }]);
  });

  describe("unique-violation translation", () => {
    it("create translates P2002 into ConflictError", async () => {
      prisma.task.create.mockRejectedValue(buildUniqueViolationError(["title"]));
      await expect(repo.create({ shopId: "shop-1", title: "Dup" } as any)).rejects.toThrow(
        ConflictError,
      );
    });

    it("update translates P2002 into ConflictError", async () => {
      prisma.task.update.mockRejectedValue(buildUniqueViolationError(["title"]));
      await expect(repo.update("task-1", { title: "Dup" } as any)).rejects.toThrow(ConflictError);
    });

    it("rethrows non-P2002 errors from create", async () => {
      const error = new Error("database down");
      prisma.task.create.mockRejectedValue(error);
      await expect(repo.create({ shopId: "shop-1", title: "X" } as any)).rejects.toThrow(error);
    });

    it("rethrows non-P2002 errors from update", async () => {
      const error = new Error("database down");
      prisma.task.update.mockRejectedValue(error);
      await expect(repo.update("task-1", { title: "X" } as any)).rejects.toThrow(error);
    });
  });

  describe("TaskRepository.transitionIfStatusIn", () => {
    it("calls updateMany with a status-scoped, void-excluding guard", async () => {
      prisma.task.updateMany.mockResolvedValue({ count: 1 });
      const count = await repo.transitionIfStatusIn("task-1", TaskStatus.NOT_STARTED, {
        status: TaskStatus.IN_PROGRESS,
      });
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { id: "task-1", status: TaskStatus.NOT_STARTED, voidedAt: null },
        data: { status: TaskStatus.IN_PROGRESS },
      });
      expect(count).toBe(1);
    });

    it("returns 0 when the row's status no longer matches `from`", async () => {
      prisma.task.updateMany.mockResolvedValue({ count: 0 });
      const count = await repo.transitionIfStatusIn("task-1", TaskStatus.NOT_STARTED, {
        status: TaskStatus.BLOCKED,
      });
      expect(count).toBe(0);
    });
  });
});
