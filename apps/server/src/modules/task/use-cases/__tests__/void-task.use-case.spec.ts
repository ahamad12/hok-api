// use-cases/__tests__/void-task.use-case.spec.ts
import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { buildTask } from "../../../../test/fixtures/task.fixture";
import { VoidTaskUseCase } from "../void-task.use-case";

describe("VoidTaskUseCase", () => {
  let taskRepository: any;
  let eventEmitter: any;
  let useCase: VoidTaskUseCase;

  const base = {
    requesterId: "owner-1",
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
    taskId: "task-1",
    voidReason: "duplicate entry",
  };

  beforeEach(() => {
    taskRepository = {
      findById: vi
        .fn()
        .mockResolvedValue(
          buildTask({ id: "task-1", shopId: "shop-1", status: "NOT_STARTED" as any }),
        ),
      update: vi.fn().mockResolvedValue(
        buildTask({
          id: "task-1",
          voidedAt: new Date(),
          voidedById: "owner-1",
          voidReason: "duplicate entry",
        }),
      ),
    };
    eventEmitter = { emit: vi.fn() };
    useCase = new VoidTaskUseCase(taskRepository, eventEmitter);
  });

  it("throws NotFoundError when task does not exist or is already voided", async () => {
    taskRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(base)).rejects.toThrow(NotFoundError);
    taskRepository.findById.mockResolvedValue(buildTask({ voidedAt: new Date() }));
    await expect(useCase.execute(base)).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF tries to void (even supervisor)", async () => {
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: "shop-1" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws AuthorizationError when a MANAGER targets a shop outside their business", async () => {
    await expect(
      useCase.execute({
        ...base,
        requesterRole: UserRole.MANAGER,
        requesterShopId: null,
        requesterTenantShopIds: ["foreign-tenant-shop"],
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws BusinessRuleError when DONE without completedAt (inconsistent state)", async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ status: "DONE" as any, completedAt: null }),
    );
    await expect(useCase.execute(base)).rejects.toThrow(BusinessRuleError);
  });

  it("updates the task with voidedAt, voidedById and voidReason", async () => {
    await useCase.execute(base);
    expect(taskRepository.update).toHaveBeenCalledWith("task-1", {
      voidedAt: expect.any(Date),
      voidedById: "owner-1",
      voidReason: "duplicate entry",
    });
  });

  it("emits task.voided and returns the voided task", async () => {
    const result = await useCase.execute(base);
    expect(eventEmitter.emit).toHaveBeenCalledWith("task.voided", {
      taskId: "task-1",
      shopId: "shop-1",
      voidedById: "owner-1",
      voidReason: "duplicate entry",
    });
    expect(result.voidedAt).not.toBeNull();
    expect(result.voidReason).toBe("duplicate entry");
  });
});
