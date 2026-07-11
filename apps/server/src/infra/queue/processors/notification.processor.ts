import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import { type Job, UnrecoverableError } from "bullmq";
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
  constructor(@Inject(SentryService) private readonly sentry: SentryService) {
    super();
  }

  async process(_job: Job<NotificationJobData>): Promise<{ sent: boolean; messageId: string }> {
    throw new UnrecoverableError("Notification delivery not implemented");
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<NotificationJobData>, error: Error) {
    this.sentry.captureException(error, {
      jobId: String(job.id),
      userId: job.data.userId,
      type: job.data.type,
    });
  }
}
