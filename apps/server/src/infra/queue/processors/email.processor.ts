import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import { type Job, UnrecoverableError } from "bullmq";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";
import type { EmailService } from "../../email/email.service";
import type { SentryService } from "../../sentry/sentry.service";

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
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<{ sent: boolean; to: string }> {
    try {
      this.logger.info(`Processing email job ${job.id}`, { to: job.data.to });

      if (job.data.templateId) {
        await this.emailService.sendTemplate({
          to: job.data.to,
          templateId: job.data.templateId,
          dynamicTemplateData: {},
        });
      } else {
        await this.emailService.send({
          to: job.data.to,
          subject: job.data.subject,
          text: job.data.body,
        });
      }

      return { sent: true, to: job.data.to };
    } catch (err) {
      this.sentry.captureException(err, { queue: "email", jobId: String(job.id) });

      // biome-ignore lint/suspicious/noExplicitAny: BullMQ/SendGrid errors are untyped
      const status = (err as any)?.code ?? (err as any)?.response?.statusCode;
      if (typeof status === "number" && status >= 400 && status < 500) {
        throw new UnrecoverableError(
          `Email job ${job.id} permanently failed: ${(err as Error).message}`,
        );
      }
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
