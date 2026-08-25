// use-cases/__tests__/transition-task.use-case.spec.ts
import { TaskStatus, UserRole } from "@tapt-api/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../../common/errors";
import { buildTask } from "../../../../test/fixtures/task.fixture";
import { TransitionTaskUseCase } from "../transition-task.use-case";

describe("TransitionTaskUseCase", () => {
  let taskRepository: any;
  let eventEmitter: any;
  let useCase: TransitionTaskUseCase;

  beforeEach(() => {
    taskRepository = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(
          buildTask({ id: "task-1", shopId: "shop-1", status: TaskStatus.NOT_STARTED }),
        )
        .mockResolvedValueOnce(
          buildTask({ id: "task-1", shopId: "shop-1", status: TaskStatus.IN_PROGRESS }),
        ),
      transitionIfStatusIn: vi.fn().mockResolvedValue(1),
    };
    eventEmitter = { emit: vi.fn() };
    useCase = new TransitionTaskUseCase(taskRepository, eventEmitter);
  });

  const base = {
    requesterId: "owner-1",
    requesterRole: UserRole.OWNER,
    requesterShopId: null,
    taskId: "task-1",
    to: TaskStatus.IN_PROGRESS,
  };

  it("throws NotFoundError when task does not exist or is voided", async () => {
    taskRepository.findById = vi.fn().mockResolvedValue(null);
    useCase = new TransitionTaskUseCase(taskRepository, eventEmitter);
    await expect(useCase.execute(base)).rejects.toThrow(NotFoundError);
    taskRepository.findById = vi.fn().mockResolvedValue(buildTask({ voidedAt: new Date() }));
    useCase = new TransitionTaskUseCase(taskRepository, eventEmitter);
    await expect(useCase.execute(base)).rejects.toThrow(NotFoundError);
  });

  it("throws AuthorizationError when STAFF transitions a task from another shop or not owned", async () => {
    taskRepository.findById = vi
      .fn()
      .mockResolvedValue(
        buildTask({ id: "task-1", shopId: "shop-1", status: TaskStatus.NOT_STARTED }),
      );
    useCase = new TransitionTaskUseCase(taskRepository, eventEmitter);
    await expect(
      useCase.execute({ ...base, requesterRole: UserRole.STAFF, requesterShopId: "other-shop" }),
    ).rejects.toThrow(AuthorizationError);
    taskRepository.findById = vi
      .fn()
      .mockResolvedValue(buildTask({ assigneeId: "other", createdById: "other" }));
    useCase = new TransitionTaskUseCase(taskRepository, eventEmitter);
    await expect(
      useCase.execute({
        ...base,
        requesterRole: UserRole.STAFF,
        requesterShopId: "shop-1",
        requesterId: "staff-1",
      }),
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws ConflictError when transition is invalid per task-transitions", async () => {
    taskRepository.findById = vi.fn().mockResolvedValue(buildTask({ status: TaskStatus.DONE }));
    useCase = new TransitionTaskUseCase(taskRepository, eventEmitter);
    await expect(useCase.execute({ ...base, to: TaskStatus.IN_PROGRESS })).rejects.toThrow(
      ConflictError,
    );
  });

  it("propagates allowed next states in the ConflictError details", async () => {
    taskRepository.findById = vi.fn().mockResolvedValue(buildTask({ status: TaskStatus.BLOCKED }));
    useCase = new TransitionTaskUseCase(taskRepository, eventEmitter);
    try {
      await useCase.execute({ ...base, to: TaskStatus.DONE });
    } catch (e: any) {
      expect(e.details).toEqual({ allowed: expect.any(Array) });
    }
  });

  it("calls transitionIfStatusIn with status-scoped guard and sets completedAt when transitioning to DONE", async () => {
    taskRepository.findById = vi
      .fn()
      .mockResolvedValueOnce(
        buildTask({ id: "task-1", shopId: "shop-1", status: TaskStatus.NOT_STARTED }),
      )
      .mockResolvedValueOnce(
        buildTask({
          id: "task-1",
          shopId: "shop-1",
          status: TaskStatus.DONE,
          completedAt: new Date(),
        }),
      );
    taskRepository.transitionIfStatusIn = vi.fn().mockResolvedValue(1);
    useCase = new TransitionTaskUseCase(taskRepository, eventEmitter);
    await useCase.execute({ ...base, to: TaskStatus.DONE });
    expect(taskRepository.transitionIfStatusIn).toHaveBeenCalledWith(
      "task-1",
      TaskStatus.NOT_STARTED,
      {
        status: "DONE",
        completedAt: expect.any(Date),
      },
    );
  });

  it("does not set completedAt when transitioning to non-DONE states", async () => {
    taskRepository.findById = vi
      .fn()
      .mockResolvedValueOnce(
        buildTask({ id: "task-1", shopId: "shop-1", status: TaskStatus.BLOCKED }),
      )
      .mockResolvedValueOnce(
        buildTask({ id: "task-1", shopId: "shop-1", status: TaskStatus.IN_PROGRESS }),
      );
    taskRepository.transitionIfStatusIn = vi.fn().mockResolvedValue(1);
    useCase = new TransitionTaskUseCase(taskRepository, eventEmitter);
    await useCase.execute({ ...base, to: TaskStatus.IN_PROGRESS });
    const callData = taskRepository.transitionIfStatusIn.mock.calls[0][2];
    expect(callData.completedAt).toBeUndefined();
  });

  it("emits task.status_changed and returns the mapped task", async () => {
    taskRepository.findById = vi
      .fn()
      .mockResolvedValueOnce(
        buildTask({ id: "task-1", shopId: "shop-1", status: TaskStatus.NOT_STARTED }),
      )
      .mockResolvedValueOnce(
        buildTask({ id: "task-1", shopId: "shop-1", status: TaskStatus.IN_PROGRESS }),
      );
    taskRepository.transitionIfStatusIn = vi.fn().mockResolvedValue(1);
    useCase = new TransitionTaskUseCase(taskRepository, eventEmitter);
    const result = await useCase.execute(base);
    expect(eventEmitter.emit).toHaveBeenCalledWith("task.status_changed", {
      taskId: "task-1",
      status: TaskStatus.IN_PROGRESS,
      shopId: "shop-1",
    });
    expect(result.status).toBe(TaskStatus.IN_PROGRESS);
  });

  // ---- concurrency cases (appended per plan) ----

  it("throws ConflictError with allowed[] when the fast-fail catches an invalid transition", async () => {
    taskRepository.findById = vi.fn().mockResolvedValue(
      buildTask({
        id: "task-1",
        shopId: "shop-1",
        status: TaskStatus.DONE,
        assigneeId: "user-1",
        createdById: "user-1",
        voidedAt: null,
      }),
    );
    taskRepository.transitionIfStatusIn = vi.fn();
    useCase = new TransitionTaskUseCase(taskRepository, eventEmitter);
    await expect(
      useCase.execute({
        requesterId: "user-1",
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        taskId: "task-1",
        to: TaskStatus.IN_PROGRESS,
      }),
    ).rejects.toThrow(ConflictError);
    expect(taskRepository.transitionIfStatusIn).not.toHaveBeenCalled();
  });

  it("throws ConflictError when transitionIfStatusIn returns 0 (concurrent write won the race)", async () => {
    taskRepository.findById = vi.fn().mockResolvedValue(
      buildTask({
        id: "task-1",
        shopId: "shop-1",
        status: TaskStatus.NOT_STARTED,
        assigneeId: "user-1",
        createdById: "user-1",
        voidedAt: null,
      }),
    );
    taskRepository.transitionIfStatusIn = vi.fn().mockResolvedValue(0);
    useCase = new TransitionTaskUseCase(taskRepository, eventEmitter);
    await expect(
      useCase.execute({
        requesterId: "user-1",
        requesterRole: UserRole.OWNER,
        requesterShopId: null,
        taskId: "task-1",
        to: TaskStatus.IN_PROGRESS,
      }),
    ).rejects.toThrow(ConflictError);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("re-reads and emits task.status_changed on a successful atomic transition", async () => {
    taskRepository.findById = vi
      .fn()
      .mockResolvedValueOnce({
        id: "task-1",
        shopId: "shop-1",
        status: TaskStatus.NOT_STARTED,
        assigneeId: "user-1",
        createdById: "user-1",
        voidedAt: null,
      } as any)
      .mockResolvedValueOnce({
        id: "task-1",
        shopId: "shop-1",
        status: TaskStatus.IN_PROGRESS,
        assigneeId: "user-1",
        createdById: "user-1",
        voidedAt: null,
      } as any);
    taskRepository.transitionIfStatusIn = vi.fn().mockResolvedValue(1);
    useCase = new TransitionTaskUseCase(taskRepository, eventEmitter);
    const result = await useCase.execute({
      requesterId: "user-1",
      requesterRole: UserRole.OWNER,
      requesterShopId: null,
      taskId: "task-1",
      to: TaskStatus.IN_PROGRESS,
    });
    expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    expect(eventEmitter.emit).toHaveBeenCalledWith("task.status_changed", {
      taskId: "task-1",
      status: TaskStatus.IN_PROGRESS,
      shopId: "shop-1",
    });
    expect(taskRepository.findById).toHaveBeenCalledTimes(2);
  });
});
