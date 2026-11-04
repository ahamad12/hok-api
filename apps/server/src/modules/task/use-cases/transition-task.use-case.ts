// apps/server/src/modules/task/use-cases/transition-task.use-case.ts
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TaskStatus, UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { allowedNextStates, isValidTransition } from "../../../common/domain/task-transitions";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../common/errors";
import { type TaskResult, toTaskResult } from "../mappers/task.mapper";
import { TaskRepository } from "../repositories/task.repository";

export interface TransitionTaskInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  taskId: string;
  to: TaskStatus;
}

@Injectable()
export class TransitionTaskUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: TransitionTaskInput): Promise<TaskResult> {
    const task = await this.taskRepository.findById(input.taskId);
    if (!task || task.voidedAt) throw new NotFoundError("Task", input.taskId);

    this.assertCanTransition(input, task.shopId, task.assigneeId, task.createdById);

    // Fast-fail: cheap, no DB write, gives `allowed` for a normal invalid
    // request (e.g. DONE -> BLOCKED) without touching the row.
    if (!isValidTransition(task.status, input.to)) {
      throw new ConflictError(`Cannot transition from ${task.status} to ${input.to}`, {
        allowed: allowedNextStates(task.status),
      });
    }

    // Atomic write: only applies if the row's status still matches what
    // we just read. A concurrent transition between the read above and
    // this write makes updatedCount 0 rather than silently overwriting.
    const updatedCount = await this.taskRepository.transitionIfStatusIn(task.id, task.status, {
      status: input.to,
      ...(input.to === TaskStatus.DONE ? { completedAt: new Date() } : {}),
    });

    if (updatedCount === 0) {
      throw new ConflictError(
        `Concurrent transition — task status changed from ${task.status} before this update applied`,
        { allowed: allowedNextStates(task.status) },
      );
    }

    const updated = await this.taskRepository.findById(task.id);
    if (!updated) throw new NotFoundError("Task", input.taskId);

    this.eventEmitter.emit("task.status_changed", {
      taskId: updated.id,
      status: updated.status,
      shopId: updated.shopId,
    });

    return toTaskResult(updated);
  }

  private assertCanTransition(
    input: TransitionTaskInput,
    taskShopId: string,
    assigneeId: string | null,
    createdById: string,
  ): void {
    // OWNER/MANAGER: any shop in their tenant, nothing outside it.
    if (input.requesterRole !== UserRole.STAFF) {
      if (!canAccessShop(requesterScope(input), taskShopId)) {
        throw new AuthorizationError("You can only transition tasks in your own business");
      }
      return;
    }

    if (input.requesterShopId !== taskShopId) {
      throw new AuthorizationError("You can only transition tasks in your own shop");
    }
    const isOwnerOfTask = input.requesterId === assigneeId || input.requesterId === createdById;
    if (!isOwnerOfTask) {
      throw new AuthorizationError("You can only transition tasks you created or are assigned to");
    }
  }
}
