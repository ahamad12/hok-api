// apps/server/src/modules/task/task.controller.ts
import { Controller } from "@nestjs/common";
import { taskContract } from "@tapt-api/api/contracts/task.contract";
import { UserRole } from "@tapt-api/db";
import { TsRestHandler } from "@ts-rest/nest";
import { CurrentUser, Roles } from "../../common/decorators";
import type { RequestUser } from "../../common/types/request-user.interface";
import { type AssignTaskInput, AssignTaskUseCase } from "./use-cases/assign-task.use-case";
import { type CreateTaskInput, CreateTaskUseCase } from "./use-cases/create-task.use-case";
import { GetTaskByIdUseCase } from "./use-cases/get-task-by-id.use-case";
import { type GetTasksInput, GetTasksUseCase } from "./use-cases/get-tasks.use-case";
import {
  type TransitionTaskInput,
  TransitionTaskUseCase,
} from "./use-cases/transition-task.use-case";
import { type UpdateTaskInput, UpdateTaskUseCase } from "./use-cases/update-task.use-case";
import { type VoidTaskInput, VoidTaskUseCase } from "./use-cases/void-task.use-case";

@Controller()
export class TaskController {
  constructor(
    private readonly createTaskUseCase: CreateTaskUseCase,
    private readonly getTasksUseCase: GetTasksUseCase,
    private readonly getTaskByIdUseCase: GetTaskByIdUseCase,
    private readonly updateTaskUseCase: UpdateTaskUseCase,
    private readonly transitionTaskUseCase: TransitionTaskUseCase,
    private readonly assignTaskUseCase: AssignTaskUseCase,
    private readonly voidTaskUseCase: VoidTaskUseCase,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(taskContract.create)
  create(@CurrentUser() user: RequestUser) {
    return async ({
      body,
    }: {
      body: Omit<CreateTaskInput, "requesterId" | "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.createTaskUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        ...body,
      });
      return { status: 201 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(taskContract.getAll)
  getAll(@CurrentUser() user: RequestUser) {
    return async ({
      query,
    }: {
      query: Omit<GetTasksInput, "requesterRole" | "requesterShopId">;
    }) => {
      const result = await this.getTasksUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        ...query,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(taskContract.getById)
  getById(@CurrentUser() user: RequestUser) {
    return async ({ params }: { params: { id: string } }) => {
      const result = await this.getTaskByIdUseCase.execute({
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        taskId: params.id,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(taskContract.update)
  update(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: Omit<UpdateTaskInput, "requesterId" | "requesterRole" | "requesterShopId" | "taskId">;
    }) => {
      const result = await this.updateTaskUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        taskId: params.id,
        ...body,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(taskContract.transition)
  transition(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: Pick<TransitionTaskInput, "to">;
    }) => {
      const result = await this.transitionTaskUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        taskId: params.id,
        ...body,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @TsRestHandler(taskContract.assign)
  assign(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: Pick<AssignTaskInput, "assigneeId">;
    }) => {
      const result = await this.assignTaskUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        taskId: params.id,
        ...body,
      });
      return { status: 200 as const, body: result };
    };
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @TsRestHandler(taskContract.voidTask)
  voidTask(@CurrentUser() user: RequestUser) {
    return async ({
      params,
      body,
    }: {
      params: { id: string };
      body: Pick<VoidTaskInput, "voidReason">;
    }) => {
      const result = await this.voidTaskUseCase.execute({
        requesterId: user.userId,
        requesterRole: user.role,
        requesterShopId: user.shopId,
        requesterTenantShopIds: user.tenantShopIds,
        taskId: params.id,
        ...body,
      });
      return { status: 200 as const, body: result };
    };
  }
}
