// use-cases/__tests__/get-task-by-id.use-case.spec.ts
import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, NotFoundError } from "../../../../common/errors";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { buildTask } from "../../../../test/fixtures/task.fixture";
import { GetTaskByIdUseCase } from "../get-task-by-id.use-case";

describe("GetTaskByIdUseCase", () => {
  let taskRepository: any;
  let useCase: GetTaskByIdUseCase;

  beforeEach(() => {
    taskRepository = {
      findById: vi.fn().mockResolvedValue(buildTask({ id: "task-1", shopId: "shop-1" })),
    };
    useCase = new GetTaskByIdUseCase(taskRepository);
  });

  const base = {
    requesterRole: UserRole.STAFF,
    requesterShopId: "shop-1",
    requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
    taskId: "task-1",
  };

  it("throws NotFoundError when task does not exist", async () => {
    taskRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(base)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError when task is voided", async () => {
    taskRepository.findById.mockResolvedValue(buildTask({ voidedAt: new Date() }));
    await expect(useCase.execute(base)).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF requests a task from another shop", async () => {
    await expect(useCase.execute({ ...base, requesterShopId: "other-shop" })).rejects.toThrow(
      AuthorizationError,
    );
  });

  it("throws AuthorizationError when MANAGER with shopId requests a different shop", async () => {
    await expect(
      useCase.execute({
        requesterRole: UserRole.MANAGER,
        requesterShopId: "shop-2",
        requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
        taskId: "task-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("returns the mapped task when authorized", async () => {
    const result = await useCase.execute(base);
    expect(result.id).toBe("task-1");
  });

  it("does not leak voided fields when not voided", async () => {
    const result = await useCase.execute(base);
    expect(result.voidedAt).toBeNull();
  });
});
