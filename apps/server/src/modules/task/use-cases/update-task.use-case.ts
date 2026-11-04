// apps/server/src/modules/task/use-cases/update-task.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { type TaskResult, toTaskResult } from "../mappers/task.mapper";
import { TaskRepository } from "../repositories/task.repository";

export interface UpdateTaskInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  taskId: string;
  title?: string;
  description?: string | null;
  dueDate?: Date | null;
  priority?: number;
}

@Injectable()
export class UpdateTaskUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(input: UpdateTaskInput): Promise<TaskResult> {
    const task = await this.taskRepository.findById(input.taskId);
    if (!task || task.voidedAt) throw new NotFoundError("Task", input.taskId);

    this.assertCanEdit(input, task.shopId, task.assigneeId, task.createdById);

    if (input.dueDate && input.dueDate.getTime() < Date.now()) {
      throw new BusinessRuleError("dueDate cannot be in the past");
    }

    const updated = await this.taskRepository.update(input.taskId, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
      ...(input.priority !== undefined && { priority: input.priority }),
    });

    return toTaskResult(updated);
  }

  private assertCanEdit(
    input: UpdateTaskInput,
    taskShopId: string,
    assigneeId: string | null,
    createdById: string,
  ): void {
    // OWNER/MANAGER: any shop in their tenant, nothing outside it.
    if (input.requesterRole !== UserRole.STAFF) {
      if (!canAccessShop(requesterScope(input), taskShopId)) {
        throw new AuthorizationError("You can only edit tasks in your own business");
      }
      return;
    }

    // STAFF
    if (input.requesterShopId !== taskShopId) {
      throw new AuthorizationError("You can only edit tasks for your own shop");
    }
    const isOwnerOfTask = input.requesterId === assigneeId || input.requesterId === createdById;
    if (!isOwnerOfTask) {
      throw new AuthorizationError("You can only edit tasks you created or are assigned to");
    }
  }
}
