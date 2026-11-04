// apps/server/src/modules/task/use-cases/get-tasks.use-case.ts
import { Injectable } from "@nestjs/common";
import { type TaskStatus, UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError } from "../../../common/errors";
import { type TaskResult, toTaskResults } from "../mappers/task.mapper";
import { TaskRepository } from "../repositories/task.repository";

export interface GetTasksInput {
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  shopId: string;
  status?: TaskStatus;
  assigneeId?: string;
  isOverdue?: boolean;
  search?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class GetTasksUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(input: GetTasksInput): Promise<{ tasks: TaskResult[]; total: number }> {
    if (!canAccessShop(requesterScope(input), input.shopId)) {
      throw new AuthorizationError("You can only view tasks for your own shop");
    }
    if (
      input.requesterRole === UserRole.MANAGER &&
      input.requesterShopId &&
      input.requesterShopId !== input.shopId
    ) {
      throw new AuthorizationError("You can only view tasks for your assigned shop");
    }

    const { tasks, total } = await this.taskRepository.findAll({
      shopId: input.shopId,
      status: input.status,
      assigneeId: input.assigneeId,
      isOverdue: input.isOverdue,
      search: input.search,
      limit: input.limit,
      offset: input.offset,
    });

    return { tasks: toTaskResults(tasks), total };
  }
}
