// apps/server/src/modules/task/queue/task-recurrence.processor.ts
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { PrismaService, TaskStatus } from "@tapt-api/db";
import type { Job } from "bullmq";
import { addDays, addMonths, addWeeks } from "date-fns";

interface RecurringConfig {
  interval: "daily" | "weekly" | "monthly";
  dayOfWeek?: number;
  dayOfMonth?: number;
}

@Processor("task-recurrence", { concurrency: 1 })
export class TaskRecurrenceProcessor extends WorkerHost {
  private readonly logger = new Logger(TaskRecurrenceProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const completedRecurring = await this.prisma.task.findMany({
      where: { isRecurring: true, status: TaskStatus.DONE, voidedAt: null },
    });

    for (const task of completedRecurring) {
      const config = task.recurringConfig as unknown as RecurringConfig | null;
      if (!config) continue;

      const nextDueDate = this.computeNextDueDate(
        task.dueDate ?? task.completedAt ?? new Date(),
        config,
      );

      // Idempotency guard per doc 4 §3: shopId + title + dueDate
      const alreadyExists = await this.prisma.task.findFirst({
        where: {
          shopId: task.shopId,
          title: task.title,
          dueDate: nextDueDate,
          voidedAt: null,
        },
      });
      if (alreadyExists) continue;

      await this.prisma.task.create({
        data: {
          shopId: task.shopId,
          title: task.title,
          description: task.description,
          assigneeId: task.assigneeId,
          status: TaskStatus.NOT_STARTED,
          dueDate: nextDueDate,
          isRecurring: true,
          recurringConfig: task.recurringConfig as never,
          priority: task.priority,
          createdById: task.createdById,
        },
      });

      this.logger.log(
        `Generated recurring task instance for ${task.id} due ${nextDueDate.toISOString()}`,
      );
    }
  }

  private computeNextDueDate(from: Date, config: RecurringConfig): Date {
    switch (config.interval) {
      case "daily":
        return addDays(from, 1);
      case "weekly":
        return addWeeks(from, 1);
      case "monthly":
        return addMonths(from, 1);
    }
  }
}
