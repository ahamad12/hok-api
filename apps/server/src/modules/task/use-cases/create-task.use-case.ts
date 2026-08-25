// apps/server/src/modules/task/use-cases/create-task.use-case.ts
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UserRole } from "@tapt-api/db";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { UserRepository } from "../../auth/repositories/user.repository";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { type TaskResult, toTaskResult } from "../mappers/task.mapper";
import { type CreateTaskData, TaskRepository } from "../repositories/task.repository";

export interface CreateTaskInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  shopId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: Date;
  priority?: number;
  isRecurring?: boolean;
  recurringConfig?: unknown;
}

@Injectable()
export class CreateTaskUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly shopRepository: ShopRepository,
    private readonly userRepository: UserRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: CreateTaskInput): Promise<TaskResult> {
    this.assertShopScope(input.requesterRole, input.requesterShopId, input.shopId);

    const shop = await this.shopRepository.findById(input.shopId);
    if (!shop || !shop.isActive) throw new NotFoundError("Shop", input.shopId);

    if (input.dueDate && input.dueDate.getTime() < Date.now()) {
      throw new BusinessRuleError("dueDate cannot be in the past");
    }

    if (input.assigneeId) {
      await this.assertValidAssignee(input.assigneeId, input.shopId);
    }

    const task = await this.taskRepository.create({
      shopId: input.shopId,
      title: input.title,
      description: input.description ?? null,
      assigneeId: input.assigneeId ?? null,
      dueDate: input.dueDate ?? null,
      isRecurring: input.isRecurring ?? false,
      recurringConfig: (input.recurringConfig ?? null) as CreateTaskData["recurringConfig"],
      priority: input.priority ?? 0,
      createdById: input.requesterId,
    });

    if (task.assigneeId) {
      this.eventEmitter.emit("task.assigned", {
        taskId: task.id,
        title: task.title,
        assigneeId: task.assigneeId,
      });
    }

    return toTaskResult(task);
  }

  private assertShopScope(
    role: UserRole,
    requesterShopId: string | null,
    targetShopId: string,
  ): void {
    if (role === UserRole.STAFF && requesterShopId !== targetShopId) {
      throw new AuthorizationError("You can only create tasks for your own shop");
    }
    // B-guard: no-op today (MANAGER.shopId is always null per current
    // invariant), activates automatically if MANAGER is later allowed a shopId.
    if (role === UserRole.MANAGER && requesterShopId && requesterShopId !== targetShopId) {
      throw new AuthorizationError("You can only create tasks for your assigned shop");
    }
  }

  private async assertValidAssignee(assigneeId: string, shopId: string): Promise<void> {
    const assignee = await this.userRepository.findById(assigneeId);
    if (!assignee || !assignee.isActive) {
      throw new BusinessRuleError("Assignee not found or inactive");
    }
    if (assignee.role !== UserRole.STAFF || assignee.shopId !== shopId) {
      throw new BusinessRuleError("Assignee must be active staff of the same shop");
    }
  }
}
