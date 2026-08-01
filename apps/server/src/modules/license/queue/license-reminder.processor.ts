import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import { SOCKET_EVENTS } from "@tapt-api/api/events";
import type { Job, Queue } from "bullmq";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import type { Logger } from "winston";
import { RedisClient } from "../../../common/redis/redis.client";
import { AppGateway } from "../../../infra/gateway/app.gateway";
import { UserRepository } from "../../auth/repositories/user.repository";
import { ShopRepository } from "../../shop/repositories/shop.repository";
import { toLicenseResult } from "../mappers/license.mapper";
import { LicenseRepository } from "../repositories/license.repository";

const SECONDS_PER_DAY = 86_400;

@Processor("license", { concurrency: 5 })
export class LicenseReminderProcessor extends WorkerHost {
  constructor(
    private readonly licenseRepository: LicenseRepository,
    private readonly shopRepository: ShopRepository,
    private readonly userRepository: UserRepository,
    private readonly redis: RedisClient,
    private readonly gateway: AppGateway,
    @InjectQueue("email") private readonly emailQueue: Queue,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "check-expiring") return;

    const today = new Date();
    const candidates = await this.licenseRepository.findCandidatesForReminder(today);
    const expiringSoon = candidates
      .map((l) => ({ license: l, result: toLicenseResult(l, today) }))
      .filter(({ result }) => result.isExpiringSoon);

    this.logger.info("license reminder scan", {
      candidateCount: candidates.length,
      expiringSoonCount: expiringSoon.length,
    });

    for (const { license, result } of expiringSoon) {
      const ttlSeconds = Math.max(license.remindDays * SECONDS_PER_DAY, SECONDS_PER_DAY);
      const dedupKey = `license-remind:${license.id}:${license.currentExpiryDate?.toISOString()}`;
      const wasSet = await this.redis.set(dedupKey, "1", "EX", ttlSeconds, "NX");
      if (!wasSet) continue;

      const shop = await this.shopRepository.findById(license.shopId);
      if (!shop) {
        this.logger.warn("license reminder: shop not found, skipping", {
          licenseId: license.id,
          shopId: license.shopId,
        });
        continue;
      }
      const owner = await this.userRepository.findById(shop.ownerId);
      if (!owner) {
        this.logger.warn("license reminder: shop owner not found, skipping", {
          licenseId: license.id,
          shopId: license.shopId,
        });
        continue;
      }

      await this.gateway.emitToShop(license.shopId, SOCKET_EVENTS.LICENSE_EXPIRING, {
        licenseId: license.id,
        productName: license.productName,
        expiryDate: license.currentExpiryDate,
        daysRemaining: result.daysRemaining,
      });

      await this.emailQueue.add(
        "license-expiry",
        {
          to: owner.email,
          subject: `License expiring soon: ${license.productName}`,
          templateId: "license-expiry-reminder",
          templateData: {
            productName: license.productName,
            licenseNumber: license.licenseNumber,
            daysRemaining: result.daysRemaining,
            expiryDate: license.currentExpiryDate,
          },
        },
        { attempts: 3 },
      );
    }
  }
}
