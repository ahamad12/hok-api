// use-cases/__tests__/update-task.use-case.spec.ts
import { UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../../common/errors";
import { buildTask } from "../../../../test/fixtures/task.fixture";
import { UpdateTaskUseCase } from "../update-task.use-case";

describe("UpdateTaskUseCase", () => {
  let taskRepository: any;
  let useCase: UpdateTaskUseCase;

  beforeEach(() => {
    taskRepository = {
      findById: vi
        .fn()
        .mockResolvedValue(buildTask({ id: "task-1", shopId: "shop-1", createdById: "owner-1" })),
      update: vi.fn().mockResolvedValue(buildTask({ id: "task-1", title: "Updated" })),
    };
    useCase = new UpdateTaskUseCase(taskRepository);
  });

  const base = {
    requesterId: "owner-1",
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    taskId: "task-1",
    title: "Updated",
  };

  it("throws NotFoundError when task does not exist or is voided", async () => {
    taskRepository.findById.mockResolvedValue(null);
    await expect(useCase.execute(base)).rejects.toThrow(NotFoundError);
    taskRepository.findById.mockResolvedValue(buildTask({ voidedAt: new Date() }));
    await expect(useCase.execute(base)).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF edits a task from another shop", async () => {
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: "other-shop" }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws AuthorizationError when STAFF is neither assignee nor creator", async () => {
    taskRepository.findById.mockResolvedValue(
      buildTask({ assigneeId: "other-staff", createdById: "other-user" }),
    );
    await expect(
      useCase.execute({
        ...base,
        requesterId: "staff-1",
        requesterRole: UserRole.STAFF,
        requesterShopId: "shop-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("allows STAFF when they are the assignee", async () => {
    taskRepository.findById.mockResolvedValue(buildTask({ assigneeId: "staff-1" }));
    await expect(
      useCase.execute({
        ...base,
        requesterId: "staff-1",
        requesterRole: UserRole.STAFF,
        requesterShopId: "shop-1",
      }),
    ).resolves.toBeDefined();
  });

  it("throws BusinessRuleError when dueDate is in the past", async () => {
    await expect(
      useCase.execute({ ...base, dueDate: new Date(Date.now() - 1000) }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it("delegates only the provided fields to repository.update", async () => {
    await useCase.execute({ ...base, description: "new desc" });
    expect(taskRepository.update).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ description: "new desc" }),
    );
  });

  it("returns the updated mapped task", async () => {
    const result = await useCase.execute(base);
    expect(result.title).toBe("Updated");
  });
});
