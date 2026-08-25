// apps/server/src/modules/task/use-cases/assign-task.use-case.ts
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { UserRepository } from "../../auth/repositories/user.repository";
import { type TaskResult, toTaskResult } from "../mappers/task.mapper";
import { TaskRepository } from "../repositories/task.repository";

export interface AssignTaskInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  taskId: string;
  assigneeId: string | null;
}

@Injectable()
export class AssignTaskUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly userRepository: UserRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: AssignTaskInput): Promise<TaskResult> {
    const task = await this.taskRepository.findById(input.taskId);
    if (!task || task.voidedAt) throw new NotFoundError("Task", input.taskId);
    if (task.status === "DONE") {
      throw new BusinessRuleError("Cannot reassign a completed task");
    }

    this.assertCanAssign(input, task.shopId, task.assigneeId, task.createdById);

    if (input.assigneeId) {
      const assignee = await this.userRepository.findById(input.assigneeId);
      if (!assignee || !assignee.isActive) {
        throw new BusinessRuleError("Assignee not found or inactive");
      }
      if (assignee.role !== UserRole.STAFF || assignee.shopId !== task.shopId) {
        throw new BusinessRuleError("Assignee must be active staff of the same shop");
      }
      if (input.requesterRole === UserRole.STAFF && assignee.shopId !== input.requesterShopId) {
        throw new AuthorizationError("You cannot assign tasks to staff outside your shop");
      }
    }

    const updated = await this.taskRepository.update(input.taskId, {
      assigneeId: input.assigneeId,
    });

    if (updated.assigneeId) {
      this.eventEmitter.emit("task.assigned", {
        taskId: updated.id,
        title: updated.title,
        assigneeId: updated.assigneeId,
      });
    }

    return toTaskResult(updated);
  }

  private assertCanAssign(
    input: AssignTaskInput,
    taskShopId: string,
    currentAssigneeId: string | null,
    createdById: string,
  ): void {
    if (input.requesterRole === UserRole.OWNER) return;

    if (input.requesterRole === UserRole.MANAGER) {
      if (input.requesterShopId && input.requesterShopId !== taskShopId) {
        throw new AuthorizationError("You can only reassign tasks in your assigned shop");
      }
      return;
    }

    if (input.requesterShopId !== taskShopId) {
      throw new AuthorizationError("You can only reassign tasks in your own shop");
    }
    const isOwnerOfTask =
      input.requesterId === currentAssigneeId || input.requesterId === createdById;
    if (!isOwnerOfTask) {
      throw new AuthorizationError(
        "You can only reassign tasks you created or are currently assigned to",
      );
    }
  }
}
