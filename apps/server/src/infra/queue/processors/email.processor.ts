import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import type { Job } from "bullmq";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";
import { EmailService } from "../../email/email.service";
import { SentryService } from "../../sentry/sentry.service";

interface EmailJobData {
  to: string;
  subject: string;
  body: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
}

@Processor("email", { concurrency: 5 })
export class EmailProcessor extends WorkerHost {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @Inject(SentryService) private readonly sentry: SentryService,
    @Inject(EmailService) private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<{ sent: boolean; to: string }> {
    if (job.data.templateId) {
      await this.emailService.sendTemplate({
        to: job.data.to,
        templateId: job.data.templateId,
        dynamicTemplateData: job.data.templateData ?? {},
      });
    } else {
      await this.emailService.send({
        to: job.data.to,
        subject: job.data.subject,
        text: job.data.body,
      });
    }

    return { sent: true, to: job.data.to };
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<EmailJobData>, error: Error) {
    this.sentry.captureException(error, { queue: "email", jobId: String(job.id) });
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<EmailJobData>) {
    this.logger.info(`Email job ${job.id} completed`, { to: job.data.to });
  }
}
