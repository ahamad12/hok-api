// apps/server/src/modules/task/use-cases/void-task.use-case.ts
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UserRole } from "@tapt-api/db";
import { canAccessShop, requesterScope } from "../../../common/domain/shop-access";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "../../../common/errors";
import { type TaskResult, toTaskResult } from "../mappers/task.mapper";
import { TaskRepository } from "../repositories/task.repository";

export interface VoidTaskInput {
  requesterId: string;
  requesterRole: UserRole;
  requesterShopId: string | null;
  requesterTenantShopIds?: readonly string[];
  taskId: string;
  voidReason: string;
}

@Injectable()
export class VoidTaskUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: VoidTaskInput): Promise<TaskResult> {
    const task = await this.taskRepository.findById(input.taskId);
    if (!task || task.voidedAt) throw new NotFoundError("Task", input.taskId);

    // Doc 4 §1.F: supervisor flag grants nothing extra here — STAFF can
    // never void, regardless of isSupervisor.
    if (input.requesterRole === UserRole.STAFF) {
      throw new AuthorizationError("Only owners and managers can void tasks");
    }
    if (!canAccessShop(requesterScope(input), task.shopId)) {
      throw new AuthorizationError("You can only void tasks in your own business");
    }
    if (task.status === "DONE" && !task.completedAt) {
      throw new BusinessRuleError("Task is in an inconsistent state (DONE without completedAt)");
    }

    const updated = await this.taskRepository.update(input.taskId, {
      voidedAt: new Date(),
      voidedById: input.requesterId,
      voidReason: input.voidReason,
    });

    this.eventEmitter.emit("task.voided", {
      taskId: updated.id,
      shopId: updated.shopId,
      voidedById: input.requesterId,
      voidReason: input.voidReason,
    });

    return toTaskResult(updated);
  }
}
