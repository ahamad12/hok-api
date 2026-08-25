// use-cases/__tests__/create-task.use-case.spec.ts
import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { buildShop } from "../../../../test/fixtures/shop.fixture";
import { buildTask } from "../../../../test/fixtures/task.fixture";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { CreateTaskUseCase } from "../create-task.use-case";

describe("CreateTaskUseCase", () => {
  let shopRepository: any;
  let userRepository: any;
  let taskRepository: any;
  let eventEmitter: any;
  let useCase: CreateTaskUseCase;

  const base = {
    requesterId: "owner-1",
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    shopId: "shop-1",
    title: "Stock check",
  };

  beforeEach(() => {
    shopRepository = {
      findById: vi.fn().mockResolvedValue(buildShop({ id: "shop-1", isActive: true })),
    };
    userRepository = { findById: vi.fn() };
    taskRepository = { create: vi.fn().mockResolvedValue(buildTask({ title: "Stock check" })) };
    eventEmitter = { emit: vi.fn() };
    useCase = new CreateTaskUseCase(taskRepository, shopRepository, userRepository, eventEmitter);
  });

  it("throws AuthorizationError when STAFF targets a different shop", async () => {
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: "other-shop" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws NotFoundError when shop does not exist or is inactive", async () => {
    shopRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(base)).rejects.toThrow(NotFoundError);
    shopRepository.findById.mockResolvedValue(buildShop({ isActive: false }));
    await expect(useCase.execute(base)).rejects.toThrow(NotFoundError);
  });

  it("throws BusinessRuleError when dueDate is in the past", async () => {
    await expect(
      useCase.execute({ ...base, dueDate: new Date(Date.now() - 1000) }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("throws BusinessRuleError when assignee does not exist or is inactive", async () => {
    userRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute({ ...base, assigneeId: "staff-1" })).rejects.toThrow(
      BusinessRuleError,
    );
    userRepository.findById.mockResolvedValue(buildUser({ isActive: false }));
    await expect(useCase.execute({ ...base, assigneeId: "staff-1" })).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("throws BusinessRuleError when assignee is not STAFF of the same shop", async () => {
    userRepository.findById.mockResolvedValue(
      buildUser({ role: UserRole.MANAGER, shopId: "shop-1" }),
    );
    await expect(useCase.execute({ ...base, assigneeId: "staff-1" })).rejects.toThrow(
      BusinessRuleError,
    );
    userRepository.findById.mockResolvedValue(
      buildUser({ role: UserRole.STAFF, shopId: "other-shop" }),
    );
    await expect(useCase.execute({ ...base, assigneeId: "staff-1" })).rejects.toThrow(
      BusinessRuleError,
    );
  });

  it("creates the task with defaults for optional fields", async () => {
    await useCase.execute(base);
    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        shopId: "shop-1",
        title: "Stock check",
        description: null,
        assigneeId: null,
        dueDate: null,
        isRecurring: false,
        priority: 0,
        createdById: "owner-1",
      }),
    );
  });

  it("passes through assignee, dueDate and priority when given", async () => {
    const due = new Date(Date.now() + 86400000);
    userRepository.findById.mockResolvedValue(buildUser({ shopId: "shop-1" }));
    await useCase.execute({ ...base, assigneeId: "staff-1", dueDate: due, priority: 5 });
    expect(taskRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeId: "staff-1", dueDate: due, priority: 5 }),
    );
  });

  it("emits task.assigned when an assignee is set", async () => {
    userRepository.findById.mockResolvedValue(buildUser({ shopId: "shop-1" }));
    taskRepository.create.mockResolvedValue(buildTask({ assigneeId: "staff-1" }));
    await useCase.execute({ ...base, assigneeId: "staff-1" });
    expect(eventEmitter.emit).toHaveBeenCalledWith("task.assigned", {
      taskId: expect.any(String),
      title: "Stock check",
      assigneeId: "staff-1",
    });
  });

  it("does not emit when no assignee", async () => {
    await useCase.execute(base);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("returns the mapped task result", async () => {
    const result = await useCase.execute(base);
    expect(result.title).toBe("Stock check");
  });
});
