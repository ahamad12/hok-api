import { Inject } from "@nestjs/common";
import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

import { SentryService } from "../../sentry/sentry.service";

interface NotificationJobData {
  userId: string;
  type: "push" | "in-app" | "sms";
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

@Processor("notification", { concurrency: 10 })
export class NotificationProcessor extends WorkerHost {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly sentry: SentryService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<{ sent: boolean; type: string; userId: string }> {
    try {
      this.logger.info(`Processing notification job ${job.id}`, {
        type: job.data.type,
        userId: job.data.userId,
      });

      // TODO: Wire notification service when implemented
      await new Promise((resolve) => setTimeout(resolve, 500));

      return { sent: true, type: job.data.type, userId: job.data.userId };
    } catch (err) {
      this.sentry.captureException(err, {
        queue: "notification",
        jobId: String(job.id),
        userId: job.data.userId,
      });
      throw err;
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<NotificationJobData>, error: Error) {
    this.logger.error(`Notification job ${job.id} failed after ${job.attemptsMade} attempts`, {
      userId: job.data.userId,
      type: job.data.type,
      error: error.message,
    });
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<NotificationJobData>) {
    this.logger.info(`Notification job ${job.id} completed`, {
      userId: job.data.userId,
      type: job.data.type,
    });
  }
}
