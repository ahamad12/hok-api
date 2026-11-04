import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import type { Job } from "bullmq";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";
import { TokenService } from "../services/token.service";
import { AUTH_MAINTENANCE_QUEUE, CLEANUP_REFRESH_TOKENS_JOB } from "./auth-maintenance.constants";

@Processor(AUTH_MAINTENANCE_QUEUE, { concurrency: 1 })
export class AuthMaintenanceProcessor extends WorkerHost {
  constructor(
    private readonly tokenService: TokenService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== CLEANUP_REFRESH_TOKENS_JOB) return;
    const deleted = await this.tokenService.cleanupExpiredTokens();
    this.logger.info("refresh token cleanup", { deleted });
  }
}
