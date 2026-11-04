// use-cases/__tests__/assign-task.use-case.spec.ts
import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { buildTask } from "../../../../test/fixtures/task.fixture";
import { buildUser } from "../../../../test/fixtures/user.fixture";
import { AssignTaskUseCase } from "../assign-task.use-case";

describe("AssignTaskUseCase", () => {
  let taskRepository: any;
  let userRepository: any;
  let eventEmitter: any;
  let useCase: AssignTaskUseCase;

  beforeEach(() => {
    taskRepository = {
      findById: vi
        .fn()
        .mockResolvedValue(
          buildTask({ id: "task-1", shopId: "shop-1", status: "NOT_STARTED" as any }),
        ),
      update: vi.fn().mockResolvedValue(buildTask({ id: "task-1", assigneeId: "staff-1" })),
    };
    userRepository = {
      findById: vi.fn().mockResolvedValue(buildUser({ id: "staff-1", shopId: "shop-1" })),
    };
    eventEmitter = { emit: vi.fn() };
    useCase = new AssignTaskUseCase(taskRepository, userRepository, eventEmitter);
  });

  const base = {
    requesterId: "owner-1",
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
    taskId: "task-1",
    assigneeId: "staff-1",
  };

  it("throws NotFoundError when task does not exist or is voided", async () => {
    taskRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(base)).rejects.toThrow(NotFoundError);
    taskRepository.findById.mockResolvedValue(buildTask({ voidedAt: new Date() }));
    await expect(useCase.execute(base)).rejects.toThrow(NotFoundError);
  });

  it("throws BusinessRuleError when task is DONE", async () => {
    taskRepository.findById.mockResolvedValue(buildTask({ status: "DONE" as any }));
    await expect(useCase.execute(base)).rejects.toThrow(BusinessRuleError);
  });

  it("throws AuthorizationError when STAFF reassigns outside own shop or not owner", async () => {
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: "other-shop" }),
    ).rejects.toThrow(AuthorizationError);
    taskRepository.findById.mockResolvedValue(
      buildTask({ assigneeId: "other", createdById: "other" }),
    );
    await expect(
      useCase.execute({
        ...base,
        requesterRole: UserRole.STAFF,
        requesterShopId: "shop-1",
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        requesterId: "staff-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws BusinessRuleError when assignee does not exist, inactive, or wrong shop/role", async () => {
    userRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(base)).rejects.toThrow(BusinessRuleError);
    userRepository.findById.mockResolvedValue(buildUser({ isActive: false }));
    await expect(useCase.execute(base)).rejects.toThrow(BusinessRuleError);
    userRepository.findById.mockResolvedValue(buildUser({ shopId: "other-shop" }));
    await expect(useCase.execute(base)).rejects.toThrow(BusinessRuleError);
    userRepository.findById.mockResolvedValue(buildUser({ role: UserRole.MANAGER } as any));
    await expect(useCase.execute(base)).rejects.toThrow(BusinessRuleError);
  });

  it("allows unassigning by setting assigneeId to null", async () => {
    taskRepository.update.mockResolvedValue(buildTask({ assigneeId: null }));
    const result = await useCase.execute({ ...base, assigneeId: null });
    expect(taskRepository.update).toHaveBeenCalledWith("task-1", { assigneeId: null });
    expect(result.assigneeId).toBeNull();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("emits task.assigned when assignee is set", async () => {
    await useCase.execute(base);
    expect(eventEmitter.emit).toHaveBeenCalledWith("task.assigned", {
      taskId: "task-1",
      title: expect.any(String),
      assigneeId: "staff-1",
    });
  });

  it("returns the updated mapped task", async () => {
    const result = await useCase.execute(base);
    expect(result.assigneeId).toBe("staff-1");
  });
});
