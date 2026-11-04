// use-cases/__tests__/get-tasks.use-case.spec.ts
import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../../common/errors";
import { TEST_TENANT_SHOP_IDS } from "../../../../test/fixtures/request-user.fixture";
import { buildTask } from "../../../../test/fixtures/task.fixture";
import { GetTasksUseCase } from "../get-tasks.use-case";

describe("GetTasksUseCase", () => {
  let taskRepository: any;
  let useCase: GetTasksUseCase;

  const base = {
    requesterRole: UserRole.MANAGER,
    requesterShopId: null,
    requesterTenantShopIds: TEST_TENANT_SHOP_IDS,
    shopId: "shop-1",
    limit: 50,
    offset: 0,
  };

  beforeEach(() => {
    taskRepository = { findAll: vi.fn().mockResolvedValue({ tasks: [], total: 0 }) };
    useCase = new GetTasksUseCase(taskRepository);
  });

  it("throws AuthorizationError when STAFF requests a different shop", async () => {
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: "other-shop" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws AuthorizationError when MANAGER with shopId requests a different shop", async () => {
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.MANAGER, requesterShopId: "shop-2" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("delegates to repository with all filters and maps the result", async () => {
    const tasks = [buildTask({ id: "task-1" })];
    taskRepository.findAll.mockResolvedValue({ tasks, total: 1 });
    const result = await useCase.execute({
      ...base,
      status: "IN_PROGRESS" as any,
      assigneeId: "staff-1",
      isOverdue: true,
      search: "stock",
    });
    expect(taskRepository.findAll).toHaveBeenCalledWith({
      shopId: "shop-1",
      status: "IN_PROGRESS",
      assigneeId: "staff-1",
      isOverdue: true,
      search: "stock",
      limit: 50,
      offset: 0,
    });
    expect(result.tasks).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("passes through when no filters are given", async () => {
    const result = await useCase.execute(base);
    expect(result.tasks).toEqual([]);
    expect(result.total).toBe(0);
  });
});
