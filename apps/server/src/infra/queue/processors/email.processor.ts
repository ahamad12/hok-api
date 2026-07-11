import { Inject } from "@nestjs/common";
import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";

import { SentryService } from "../../sentry/sentry.service";

interface EmailJobData {
  to: string;
  subject: string;
  body: string;
  templateId?: string;
}

@Processor("email", { concurrency: 5 })
export class EmailProcessor extends WorkerHost {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly sentry: SentryService,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<{ sent: boolean; to: string }> {
    try {
      this.logger.info(`Processing email job ${job.id}`, { to: job.data.to });

      // TODO: Wire SendGrid in D18
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return { sent: true, to: job.data.to };
    } catch (err) {
      this.sentry.captureException(err, { queue: "email", jobId: String(job.id) });
      throw err;
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<EmailJobData>, error: Error) {
    this.logger.error(`Email job ${job.id} failed after ${job.attemptsMade} attempts`, {
      to: job.data.to,
      error: error.message,
    });
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<EmailJobData>) {
    this.logger.info(`Email job ${job.id} completed`, { to: job.data.to });
  }
}
