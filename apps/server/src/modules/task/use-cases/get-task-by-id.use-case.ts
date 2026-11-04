// apps/server/src/modules/task/use-cases/get-task-by-id.use-case.ts
import { Injectable } from "@nestjs/common";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, NotFoundError } from "../../../common/errors";
import { type TaskResult, toTaskResult } from "../mappers/task.mapper";
import { TaskRepository } from "../repositories/task.repository";

export interface GetTaskByIdInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  taskId: string;
}

@Injectable()
export class GetTaskByIdUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(input: GetTaskByIdInput): Promise<TaskResult> {
    const task = await this.taskRepository.findById(input.taskId);
    if (!task || task.voidedAt) throw new NotFoundError("Task", input.taskId);

    if (!canAccessShop(requesterScope(input), task.shopId)) {
      throw new AuthorizationError("You can only view tasks for your own shop");
    }
    if (
      input.requesterRole === UserRole.MANAGER &&
      input.requesterShopId &&
      input.requesterShopId !== task.shopId
    ) {
      throw new AuthorizationError("You can only view tasks for your assigned shop");
    }

    return toTaskResult(task);
  }
}
