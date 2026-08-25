// apps/server/src/modules/task/task.module.ts

import { BullModule } from "@nestjs/bullmq";
import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ShopModule } from "../shop/shop.module";
import { TaskRecurrenceProcessor } from "./queue/task-recurrence.processor";
import { TaskRepository } from "./repositories/task.repository";
import { TaskController } from "./task.controller";
import { AssignTaskUseCase } from "./use-cases/assign-task.use-case";
import { CreateTaskUseCase } from "./use-cases/create-task.use-case";
import { GetTaskByIdUseCase } from "./use-cases/get-task-by-id.use-case";
import { GetTasksUseCase } from "./use-cases/get-tasks.use-case";
import { TransitionTaskUseCase } from "./use-cases/transition-task.use-case";
import { UpdateTaskUseCase } from "./use-cases/update-task.use-case";
import { VoidTaskUseCase } from "./use-cases/void-task.use-case";

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => ShopModule),
    BullModule.registerQueue({ name: "task-recurrence" }),
  ],
  controllers: [TaskController],
  providers: [
    TaskRepository,
    CreateTaskUseCase,
    GetTasksUseCase,
    GetTaskByIdUseCase,
    UpdateTaskUseCase,
    TransitionTaskUseCase,
    AssignTaskUseCase,
    VoidTaskUseCase,
    TaskRecurrenceProcessor,
  ],
  exports: [TaskRepository],
})
export class TaskModule {}
